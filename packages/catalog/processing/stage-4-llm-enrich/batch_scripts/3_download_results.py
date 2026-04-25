import argparse
import json
import os
from google import genai
from dotenv import load_dotenv

load_dotenv()


from google.genai.types import HttpOptions


def get_client(project, location):
    """Initializes the Vertex AI client."""
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    os.environ["GOOGLE_CLOUD_LOCATION"] = location
    return genai.Client(http_options=HttpOptions(api_version="v1"))


def main():
    parser = argparse.ArgumentParser(description="Download Gemini Batch Job Results")
    parser.add_argument(
        "--cache", default="vertex_job_cache.json", help="Cache file with job metadata"
    )
    parser.add_argument(
        "--output",
        default="../enriched_feeds_batch_output.jsonl",
        help="Final output file",
    )
    parser.add_argument("--project", help="GCP Project ID")
    parser.add_argument("--location", default="global", help="GCP Region")
    parser.add_argument(
        "--local-input",
        help="Path to a local file containing the batch results (skips download)",
    )

    args = parser.parse_args()

    line_iterator = None

    # Context manager placeholder if needed (for local file)
    file_handle = None

    try:
        # If local input is provided, use it
        if args.local_input:
            if not os.path.exists(args.local_input):
                print(f"Error: Local file {args.local_input} not found.")
                return

            print(f"Reading results from local file: {args.local_input}")
            # Open file for iteration
            file_handle = open(args.local_input, "r", encoding="utf-8")
            line_iterator = file_handle

        else:
            # Existing logic for downloading
            if not os.path.exists(args.cache):
                print(f"Error: Cache file {args.cache} not found.")
                return

            with open(args.cache, "r") as f:
                metadata = json.load(f)

            job_name = metadata.get("job_name")
            state = metadata.get("status")

            project = os.environ.get("GOOGLE_CLOUD_PROJECT") or args.project
            location = (
                os.environ.get("GOOGLE_CLOUD_LOCATION", "global") or args.location
            )

            if not project:
                print(
                    "Error: Project ID must be set via --project or GOOGLE_CLOUD_PROJECT."
                )
                return

            client = get_client(project, location)

            output_file_name = metadata.get("output_file_name")

            if not output_file_name or state != "JOB_STATE_SUCCEEDED":
                print("Checking latest job status...")
                job = client.batches.get(name=job_name)
                # We can try to proceed even if not SUCCEEDED if we just want to grab what's there?
                # But usually output definition is needed.
                if job.state.name != "JOB_STATE_SUCCEEDED":
                    print(
                        f"Job is not ready (State: {job.state.name}). Proceeding with caution if output exists..."
                    )

                if job.dest and job.dest.file_name:
                    output_file_name = job.dest.file_name
                else:
                    print("Job succeeded but no output file name found.")
                    return

            print(f"Downloading results from: {output_file_name}")

            try:
                # Download full content (Vertex Batch output determines size)
                # For very large files, streaming download is better, but client.files.download returns bytes.
                file_content_bytes = client.files.download(file=output_file_name)
                # Decode and Create StringIO for consistent line-by-line processing
                import io

                line_iterator = io.StringIO(file_content_bytes.decode("utf-8"))
            except Exception as e:
                print(f"Error downloading file: {e}")
                return

        print(f"Processing content and saving to {args.output}...")

        success_count = 0
        error_count = 0

        with open(args.output, "w", encoding="utf-8") as f_out:
            if line_iterator:
                for line_num, line in enumerate(line_iterator, 1):
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)

                        key = data.get("key")

                        if "error" in data:
                            print(
                                f"Line {line_num}: Error for key {key}: {data['error']}"
                            )
                            error_count += 1
                            continue

                        response = data.get("response", {})
                        candidates = response.get("candidates", [])

                        if candidates:
                            candidate = candidates[0]
                            finish_reason = candidate.get("finishReason")
                            if finish_reason == "MAX_TOKENS":
                                print(
                                    f"Line {line_num}: Warning: Response truncated (MAX_TOKENS) for key {key}. Skipping."
                                )
                                error_count += 1
                                continue

                            # Usually there is only one candidate for these tasks
                            content = candidate.get("content", {})
                            parts = content.get("parts", [])
                            if parts:
                                text_result = parts[0].get("text", "")

                                # Clean up markdown formatting if present
                                clean_text = text_result.strip()
                                if clean_text.startswith("```json"):
                                    clean_text = clean_text[7:]
                                elif clean_text.startswith("```"):
                                    clean_text = clean_text[3:]
                                if clean_text.endswith("```"):
                                    clean_text = clean_text[:-3]
                                clean_text = clean_text.strip()

                                try:
                                    # Parse the inner JSON
                                    # This is now an EnrichmentResponse containing a list of results
                                    inner_data = json.loads(clean_text)

                                    # Handle case where model returns a list directly or a dict with 'results'
                                    if isinstance(inner_data, dict):
                                        results_list = inner_data.get("results", [])
                                    elif isinstance(inner_data, list):
                                        results_list = inner_data
                                    else:
                                        print(
                                            f"Unexpected inner data type for key {key}: {type(inner_data)}"
                                        )
                                        results_list = []

                                    count_in_batch = 0
                                    for res in results_list:
                                        # res is a dict (EnrichmentResult)
                                        f_out.write(
                                            json.dumps(res, ensure_ascii=False) + "\n"
                                        )
                                        count_in_batch += 1
                                        success_count += 1

                                    if count_in_batch == 0:
                                        print(
                                            f"Line {line_num}: Warning: No results found in batch {key}"
                                        )

                                except json.JSONDecodeError:
                                    print(
                                        f"Line {line_num}: Failed to parse inner JSON for key {key}. Text start: {clean_text[:50]}..."
                                    )
                                    # Optional: Write failed text to a file for inspection
                                    with open("failed_parse.txt", "a") as f_err:
                                        f_err.write(
                                            f"Line {line_num}:\n{clean_text}\n---\n"
                                        )
                                    error_count += 1
                            else:
                                print(
                                    f"Line {line_num}: No parts in response for key {key}"
                                )
                                error_count += 1
                        else:
                            print(f"Line {line_num}: No candidates for key {key}")
                            error_count += 1

                    except json.JSONDecodeError as e:
                        print(f"Line {line_num}: Error parsing batch line JSON: {e}")
                        error_count += 1
                    except Exception as e:
                        print(f"Line {line_num}: Unexpected error processing line: {e}")
                        error_count += 1

        print(f"Processing complete. Success: {success_count}, Errors: {error_count}")
        print(f"Results saved to {args.output}")

    finally:
        if file_handle:
            file_handle.close()


if __name__ == "__main__":
    main()
