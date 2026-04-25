import argparse
import json
import os
import time
from datetime import datetime, timezone
import dateutil.parser

from google import genai
from google.genai.types import HttpOptions
from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.live import Live
from rich.text import Text
from rich import box

load_dotenv()

console = Console()


def load_metadata(cache_path):
    """Loads job metadata from the local cache file."""
    if not os.path.exists(cache_path):
        console.print(
            f"[bold red]Error:[/bold red] Cache file '{cache_path}' not found."
        )
        console.print("Please run the submission script first.")
        return None

    with open(cache_path, "r") as f:
        return json.load(f)


def save_metadata(cache_path, metadata):
    """Updates the local cache file."""
    with open(cache_path, "w") as f:
        json.dump(metadata, f, indent=2)


def get_client(project, location):
    """Initializes the Vertex AI client."""
    os.environ["GOOGLE_GENAI_USE_VERTEXAI"] = "True"
    os.environ["GOOGLE_CLOUD_PROJECT"] = project
    os.environ["GOOGLE_CLOUD_LOCATION"] = location
    return genai.Client(http_options=HttpOptions(api_version="v1"))


def format_time(iso_str):
    """Parses ISO timestamp and returns a readable string and datetime obj."""
    if not iso_str:
        return "N/A", None
    dt = dateutil.parser.isoparse(iso_str)
    return dt.strftime("%Y-%m-%d %H:%M:%S"), dt


def generate_progress_bar(percent, width=20):
    """Generates a simple text-based progress bar."""
    filled = int(width * percent / 100)
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {percent:.1f}%"


def create_status_table(job_data):
    """Creates a pretty Rich table for the current job status."""
    state = job_data.get("state", "UNKNOWN")

    # --- 1. State Colors ---
    state_color = "yellow"
    if state == "JOB_STATE_SUCCEEDED":
        state_color = "green"
    elif state in ["JOB_STATE_FAILED", "JOB_STATE_CANCELLED"]:
        state_color = "red"
    elif state == "JOB_STATE_RUNNING":
        state_color = "blue"

    # --- 2. Duration Calculation ---
    created_str, created_dt = format_time(job_data.get("create_time"))
    _, updated_dt = format_time(job_data.get("update_time"))

    duration = "N/A"
    if created_dt:
        # If running, compare to NOW. If finished, compare to UPDATE time.
        end_time = (
            datetime.now(timezone.utc)
            if state in ["JOB_STATE_RUNNING", "JOB_STATE_PENDING"]
            else updated_dt
        )
        if end_time:
            diff = end_time - created_dt
            duration = str(diff).split(".")[0]  # Remove microseconds

    # --- 3. Progress Stats ---
    stats = job_data.get("completion_stats", {})
    # API usually returns: successful_count, failed_count, incomplete_count
    success = stats.get("successful_count", 0)
    failed = stats.get("failed_count", 0)
    incomplete = stats.get("incomplete_count", 0)

    # Calculate Total & Percent
    total = success + failed + incomplete
    percent = 0.0
    if total > 0:
        percent = ((success + failed) / total) * 100

    # --- 4. Build Table ---
    table = Table(box=box.ROUNDED, show_header=False, expand=True)
    table.add_column("Key", style="cyan", width=15)
    table.add_column("Value", style="white")

    # Header Info
    table.add_row("Job ID", job_data.get("name", "").split("/")[-1])
    table.add_row("Display Name", job_data.get("display_name", "N/A"))
    table.add_row("Status", Text(state, style=f"bold {state_color}"))
    table.add_row("Model", job_data.get("model", "N/A").split("/")[-1])
    table.add_section()

    # Progress Section
    progress_bar = generate_progress_bar(percent)
    table.add_row("Progress", Text(progress_bar, style="bold magenta"))
    table.add_row(
        "Counts",
        f"[green]✔ {success}[/green]  [red]✘ {failed}[/red]  [dim]... {incomplete}[/dim] (Total: {total})",
    )
    table.add_section()

    # Timing & IO
    table.add_row("Created", created_str)
    table.add_row("Duration", duration)

    src = job_data.get("src", {}).get("gcs_uri", [])
    dest = job_data.get("dest", {}).get("gcs_uri", "N/A")
    if isinstance(src, list):
        src = src[0] if src else "N/A"

    table.add_row("Input URI", str(src))
    table.add_row("Output URI", str(dest))

    if state == "JOB_STATE_FAILED":
        table.add_row("Error", f"[red]{job_data.get('error', 'Unknown Error')}[/red]")

    return Panel(
        table,
        title="[bold blue]Gemini Batch Job Monitor[/bold blue]",
        border_style="blue",
    )


def main():
    parser = argparse.ArgumentParser(description="Check Gemini Batch Job Status")
    parser.add_argument(
        "--cache", default="vertex_job_cache.json", help="Cache file with job metadata"
    )
    parser.add_argument(
        "--watch", action="store_true", help="Poll continuously until completion"
    )
    parser.add_argument(
        "--interval", type=int, default=30, help="Polling interval in seconds"
    )
    parser.add_argument("--project", help="GCP Project ID")
    parser.add_argument("--location", default="us-central1", help="GCP Region")

    args = parser.parse_args()

    # 1. Load Metadata
    metadata = load_metadata(args.cache)
    if not metadata:
        return

    job_name = metadata.get("job_name")
    if not job_name:
        console.print("[bold red]Error:[/bold red] job_name not found in metadata.")
        return

    # 2. Setup Config
    project = os.environ.get("GOOGLE_CLOUD_PROJECT") or args.project
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "global") or args.location

    if not project:
        console.print(
            "[bold red]Error:[/bold red] Project ID must be set via --project or GOOGLE_CLOUD_PROJECT."
        )
        return

    client = get_client(project, location)

    console.print(f"[dim]Checking job: {job_name} in {project} / {location}[/dim]")

    # 3. Monitor Loop
    with Live(console=console, refresh_per_second=4) as live:
        while True:
            try:
                # Fetch Job
                job = client.batches.get(name=job_name)
                job_dict = job.to_json_dict()
                print(job_dict)
                state = job.state.name

                # Update Display
                live.update(create_status_table(job_dict))

                # Update Cache
                metadata["status"] = state
                if hasattr(job, "dest") and job.dest and job.dest.file_name:
                    metadata["output_file_name"] = job.dest.file_name
                save_metadata(args.cache, metadata)

                # Check completion
                is_done = state in (
                    "JOB_STATE_SUCCEEDED",
                    "JOB_STATE_FAILED",
                    "JOB_STATE_CANCELLED",
                )

                if is_done:
                    # Final refresh to ensure "Duration" is finalized
                    live.update(create_status_table(job_dict))
                    if state == "JOB_STATE_FAILED":
                        console.print(f"[bold red]Job Failed:[/bold red] {job.error}")
                    else:
                        console.print(
                            f"\n[bold green]Job Finished: {state}[/bold green]"
                        )
                    break

                if not args.watch:
                    break

                # Sleep loop for interval (keeps the Live display active)
                steps = args.interval * 4  # 4 checks per second for smooth UI
                for _ in range(steps):
                    time.sleep(0.25)
                    # Optional: We could update a "Last checked: Xs ago" footer here if we wanted

            except Exception as e:
                console.print(f"[bold red]Exception during polling:[/bold red] {e}")
                break


if __name__ == "__main__":
    main()
