import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import List, Dict, Any

from dotenv import load_dotenv
from google import genai
from google.genai.types import CreateBatchJobConfig, JobState, HttpOptions

# Add parent directory to path to import local modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from llm_processor import EnrichmentResponse

load_dotenv()


def load_prompt(prompt_path: str) -> str:
    with open(prompt_path, "r") as f:
        return f.read()


def replace_value_in_dict(item, original_schema):
    if isinstance(item, list):
        return [replace_value_in_dict(i, original_schema) for i in item]
    elif isinstance(item, dict):
        if list(item.keys()) == ["$ref"]:
            definitions = item["$ref"][2:].split("/")
            res = original_schema.copy()
            for definition in definitions:
                res = res[definition]
            return res
        else:
            return {
                key: replace_value_in_dict(i, original_schema)
                for key, i in item.items()
            }
    else:
        return item


def resolve_schema(schema_to_resolve):
    max_tries = 100
    # Create a deep copy to work on
    schema = json.loads(json.dumps(schema_to_resolve))

    for i in range(max_tries):
        if "$ref" not in json.dumps(schema):
            break
        # We pass schema.copy() as original_schema so that lookups happen against the current state
        # (which includes definitions).
        schema = replace_value_in_dict(schema.copy(), schema.copy())

    if "$defs" in schema:
        del schema["$defs"]
    elif "definitions" in schema:
        del schema["definitions"]

    return schema


def prepare_vertex_request(
    feed_records: List[Dict[str, Any]], system_instruction: str
) -> Dict[str, Any]:
    """
    Creates a JSON object for a single request in the Vertex AI Batch Prediction format.
    Uses camelCase keys as per Vertex AI/Gemini API requirements for raw JSONL inputs.
    """
    user_content = (
        f"**Input:**\n{json.dumps(feed_records, indent=2, ensure_ascii=False)}"
    )

    # Construct schema - assuming EnrichmentResponse.model_json_schema() returns standard JSON Schema dict
    response_schema = resolve_schema(EnrichmentResponse.model_json_schema())

    # Vertex AI Batch Prediction format
    # {"request": {"contents": [...], "generationConfig": {...}}}

    request_payload = {
        "contents": [{"role": "user", "parts": [{"text": user_content}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": response_schema,
            "temperature": 0.1,
        },
    }

    if system_instruction:
        request_payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    return {"request": request_payload}


def chunk_list(data, size):
    """Yield successive n-sized chunks from data."""
    for i in range(0, len(data), size):
        yield data[i : i + size]


def generate_batch_file(args):
    """Generates the JSONL input file for Vertex AI."""
    input_path = Path(args.input)
    prompt_path = Path(args.prompt)
    output_path = Path(args.output)

    # Resolve paths
    if not input_path.exists() and (Path(__file__).parent / args.input).exists():
        input_path = Path(__file__).parent / args.input
    if not prompt_path.exists() and (Path(__file__).parent / args.prompt).exists():
        prompt_path = Path(__file__).parent / args.prompt

    if not input_path.exists():
        print(f"Error: Input file not found at {input_path}")
        return

    print(f"Reading input from {input_path}")
    print(f"Reading prompt from {prompt_path}")

    system_instruction = load_prompt(str(prompt_path))

    all_records = []
    with open(input_path, "r") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                all_records.append(json.loads(line))
            except json.JSONDecodeError:
                pass

    print(f"Loaded {len(all_records)} feeds.")

    requests_data = []
    chunk_count = 0

    # We aggregate feeds per prompt
    # Using batch size from args (default 5)
    for chunk in chunk_list(all_records, args.batch_size):
        chunk_count += 1
        req_obj = prepare_vertex_request(chunk, system_instruction)
        requests_data.append(req_obj)

    print(f"Prepared {len(requests_data)} batch requests.")

    with open(output_path, "w") as f:
        for req in requests_data:
            f.write(json.dumps(req) + "\n")

    print(f"Written batch requests to {output_path}")
    print(f"\nNEXT STEPS:")
    print(
        f"1. Upload this file to GCS: gsutil cp {output_path} gs://<YOUR_BUCKET>/inputs/{output_path.name}"
    )
    print(
        f"2. Run submit command: python 1_submit_job.py submit --gcs-uri gs://<YOUR_BUCKET>/inputs/{output_path.name} --gcs-output-uri gs://<YOUR_BUCKET>/outputs/"
    )


def submit_batch_job(args):
    """Submits the Batch Prediction job to Vertex AI using google-genai SDK."""
    if not args.gcs_uri:
        print("Error: --gcs-uri is required for submission.")
        return
    if not args.gcs_output_uri:
        print("Error: --gcs-output-uri is required for submission.")
        return

    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or args.project
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global") or args.location

    if not project:
        print(
            "Error: Project ID must be set via --project or GOOGLE_CLOUD_PROJECT env var."
        )
        return

    print(
        f"Initializing Vertex AI Client (Project: {project}, Location: {location})..."
    )

    # Set environment variables expected by SDK for Vertex AI
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    os.environ["GOOGLE_CLOUD_LOCATION"] = location

    client = genai.Client(http_options=HttpOptions(api_version="v1"))

    model_name = args.model
    # Normalization might not be needed for GenAI SDK if using short names like 'gemini-1.5-flash-002'

    print(f"Submitting Batch Job...")
    print(f"Model: {model_name}")
    print(f"Source: {args.gcs_uri}")
    print(f"Dest: {args.gcs_output_uri}")

    try:
        job = client.batches.create(
            model=model_name,
            src=args.gcs_uri,
            config=CreateBatchJobConfig(dest=args.gcs_output_uri),
        )

        print(f"Job name: {job.name}")
        print(f"Job state: {job.state}")

        # Save metadata
        metadata = {
            "job_name": job.name,
            "gcs_input": args.gcs_uri,
            "gcs_output": args.gcs_output_uri,
            "model": model_name,
            "submit_time": int(time.time()),
            "status": str(job.state),
        }

        with open("vertex_job_cache.json", "w") as f:
            json.dump(metadata, f, indent=2)
        print("Job metadata saved to vertex_job_cache.json")

        print(
            "\nTo monitor status, you can check the Google Cloud Console or run a status check script."
        )

    except Exception as e:
        print(f"Error submitting job: {e}")
        import traceback

        traceback.print_exc()


def main():
    parser = argparse.ArgumentParser(
        description="Vertex AI Batch Processing for Feed Enrichment"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # GENERATE Command
    gen_parser = subparsers.add_parser("generate", help="Generate JSONL input file")
    gen_parser.add_argument(
        "--input", default="feeds_llm_input.jsonl", help="Input local JSONL feeds"
    )
    gen_parser.add_argument("--prompt", default="../enrich_feed.md", help="Prompt file")
    gen_parser.add_argument(
        "--output", default="vertex_batch_input.jsonl", help="Output JSONL file path"
    )
    gen_parser.add_argument(
        "--batch-size", type=int, default=5, help="Feeds per request"
    )

    # SUBMIT Command
    sub_parser = subparsers.add_parser("submit", help="Submit Job to Vertex AI")
    sub_parser.add_argument(
        "--gcs-uri",
        required=True,
        help="gs:// URI to the input file (uploaded by user)",
    )
    sub_parser.add_argument(
        "--gcs-output-uri",
        required=True,
        help="gs:// URI prefix for output (e.g. gs://bucket/output/)",
    )
    sub_parser.add_argument(
        "--model", default="gemini-2.5-flash-lite", help="Model version"
    )
    sub_parser.add_argument("--project", help="GCP Project ID")
    sub_parser.add_argument("--location", default="us-central1", help="GCP Region")

    args = parser.parse_args()

    if args.command == "generate":
        generate_batch_file(args)
    elif args.command == "submit":
        submit_batch_job(args)


if __name__ == "__main__":
    main()
