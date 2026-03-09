#!/usr/bin/env python3
"""
Venice AI Audio Generation Helper
Supports: quote, queue, retrieve, complete, generate (full workflow)
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = "https://api.venice.ai/api/v1"


def get_api_key():
    key = os.environ.get("VENICE_API_KEY")
    if not key:
        print("Error: VENICE_API_KEY environment variable not set.", file=sys.stderr)
        print("Get your key at https://venice.ai/settings/api", file=sys.stderr)
        sys.exit(1)
    return key


def venice_post(endpoint: str, payload: dict) -> dict:
    api_key = get_api_key()
    url = f"{BASE_URL}{endpoint}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"HTTP {e.code} error from Venice: {body}", file=sys.stderr)
        sys.exit(1)


def cmd_quote(args):
    payload = {"model": args.model}
    if args.duration:
        payload["duration_seconds"] = args.duration
    if args.chars:
        payload["character_count"] = args.chars

    result = venice_post("/audio/quote", payload)
    quote = result.get("quote", "N/A")
    print(f"Estimated cost: ${quote:.4f} USD")
    print(json.dumps(result, indent=2))


def cmd_queue(args):
    payload = {"model": args.model, "prompt": args.prompt}
    if args.lyrics:
        payload["lyrics_prompt"] = args.lyrics
    if args.duration:
        payload["duration_seconds"] = args.duration
    if args.voice:
        payload["voice"] = args.voice
    if args.speed is not None:
        payload["speed"] = args.speed
    if args.instrumental:
        payload["force_instrumental"] = True

    result = venice_post("/audio/queue", payload)
    print(f"Queued! queue_id: {result.get('queue_id')}")
    print(f"Status: {result.get('status')}")
    print(json.dumps(result, indent=2))
    return result.get("queue_id")


def cmd_retrieve(args, poll: bool = True, save_output: bool = True):
    delete_on_complete = getattr(args, "delete_on_complete", False)
    output_path = getattr(args, "output", None)

    while True:
        payload = {
            "model": args.model,
            "queue_id": args.queue_id,
            "delete_media_on_completion": delete_on_complete,
        }
        result = venice_post("/audio/retrieve", payload)
        status = result.get("status")

        if status == "PROCESSING" or status == "QUEUED":
            avg = result.get("average_execution_time", 0)
            elapsed = result.get("execution_duration", 0)
            pct = int((elapsed / avg * 100)) if avg else 0
            print(f"  [{status}] {elapsed/1000:.1f}s / ~{avg/1000:.1f}s ({pct}%)", flush=True)
            if not poll:
                return result
            time.sleep(3)

        elif status == "COMPLETED":
            print(f"  [COMPLETED] Generation finished!")
            audio_b64 = result.get("audio") or result.get("data")
            content_type = result.get("content_type", "audio/mpeg")

            if audio_b64 and save_output and output_path:
                audio_bytes = base64.b64decode(audio_b64)
                with open(output_path, "wb") as f:
                    f.write(audio_bytes)
                print(f"  Audio saved to: {output_path}")
                print(f"  Content type: {content_type}")
                print(f"  File size: {len(audio_bytes)/1024:.1f} KB")
            elif audio_b64 and not output_path:
                print("  Audio data received (use --output to save to file)")
            return result

        elif status == "FAILED":
            print(f"  [FAILED] Generation failed.", file=sys.stderr)
            print(json.dumps(result, indent=2), file=sys.stderr)
            sys.exit(1)

        else:
            print(f"  Unknown status: {status}")
            print(json.dumps(result, indent=2))
            return result


def cmd_complete(args):
    payload = {"model": args.model, "queue_id": args.queue_id}
    result = venice_post("/audio/complete", payload)
    success = result.get("success", False)
    if success:
        print(f"Cleanup successful for queue_id: {args.queue_id}")
    else:
        print(f"Cleanup returned success=false — you can retry later.")
    print(json.dumps(result, indent=2))


def cmd_generate(args):
    """Full end-to-end workflow: quote → queue → retrieve → complete"""
    print("=== Venice AI Audio Generation ===")
    print(f"  Model:  {args.model}")
    print(f"  Prompt: {args.prompt[:80]}{'...' if len(args.prompt) > 80 else ''}")
    if args.duration:
        print(f"  Duration: {args.duration}s")
    print()

    # Step 1: Quote
    print("[1/4] Getting price quote...")
    quote_payload = {"model": args.model}
    if args.duration:
        quote_payload["duration_seconds"] = args.duration
    if getattr(args, "chars", None):
        quote_payload["character_count"] = args.chars
    quote_result = venice_post("/audio/quote", quote_payload)
    print(f"  Estimated cost: ${quote_result.get('quote', 'N/A'):.4f} USD\n")

    # Step 2: Queue
    print("[2/4] Submitting generation request...")
    queue_payload = {"model": args.model, "prompt": args.prompt}
    if getattr(args, "lyrics", None):
        queue_payload["lyrics_prompt"] = args.lyrics
    if args.duration:
        queue_payload["duration_seconds"] = args.duration
    if getattr(args, "voice", None):
        queue_payload["voice"] = args.voice
    if getattr(args, "speed", None) is not None:
        queue_payload["speed"] = args.speed
    if getattr(args, "instrumental", False):
        queue_payload["force_instrumental"] = True

    queue_result = venice_post("/audio/queue", queue_payload)
    queue_id = queue_result.get("queue_id")
    print(f"  queue_id: {queue_id}\n")

    # Step 3: Poll
    print("[3/4] Waiting for generation to complete...")

    class RetrieveArgs:
        pass

    rargs = RetrieveArgs()
    rargs.model = args.model
    rargs.queue_id = queue_id
    rargs.output = args.output
    rargs.delete_on_complete = False
    retrieve_result = cmd_retrieve(rargs)

    # Step 4: Complete (cleanup)
    print("\n[4/4] Cleaning up remote media...")

    class CompleteArgs:
        pass

    cargs = CompleteArgs()
    cargs.model = args.model
    cargs.queue_id = queue_id
    cmd_complete(cargs)

    print("\n=== Done! ===")
    if args.output:
        print(f"Your audio is at: {args.output}")


def main():
    parser = argparse.ArgumentParser(
        description="Venice AI Audio Generation Helper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Commands:
  quote      Get a price estimate before generating
  queue      Submit an audio generation request
  retrieve   Poll for completion and download audio
  complete   Clean up remote media after downloading
  generate   Full workflow: quote → queue → poll → retrieve → complete

Examples:
  python3 audio.py generate --prompt "Upbeat electronic music" --duration 60 --output track.mp3
  python3 audio.py quote --model elevenlabs-music --duration 60
  python3 audio.py queue --prompt "Calm piano music" --duration 30
  python3 audio.py retrieve --queue-id <id> --output result.mp3
  python3 audio.py complete --queue-id <id>
        """,
    )
    parser.add_argument("--model", default="elevenlabs-music", help="Model ID (default: elevenlabs-music)")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # quote
    p_quote = subparsers.add_parser("quote", help="Get a price estimate")
    p_quote.add_argument("--duration", type=int, help="Duration in seconds")
    p_quote.add_argument("--chars", type=int, help="Character count (for character-priced models)")
    p_quote.set_defaults(func=cmd_quote)

    # queue
    p_queue = subparsers.add_parser("queue", help="Submit a generation request")
    p_queue.add_argument("--prompt", required=True, help="Audio description prompt")
    p_queue.add_argument("--lyrics", help="Optional lyrics text")
    p_queue.add_argument("--duration", type=int, help="Duration in seconds")
    p_queue.add_argument("--voice", help="Voice name")
    p_queue.add_argument("--speed", type=float, help="Speed multiplier (0.25-4.0)")
    p_queue.add_argument("--instrumental", action="store_true", help="Force instrumental (no vocals)")
    p_queue.set_defaults(func=cmd_queue)

    # retrieve
    p_retrieve = subparsers.add_parser("retrieve", help="Poll for completion and download")
    p_retrieve.add_argument("--queue-id", required=True, dest="queue_id", help="queue_id from /audio/queue")
    p_retrieve.add_argument("--output", help="Output file path (e.g. /tmp/audio.mp3)")
    p_retrieve.add_argument("--delete-on-complete", action="store_true", dest="delete_on_complete",
                            help="Delete remote media after retrieval")
    p_retrieve.set_defaults(func=cmd_retrieve)

    # complete
    p_complete = subparsers.add_parser("complete", help="Clean up remote media after download")
    p_complete.add_argument("--queue-id", required=True, dest="queue_id", help="queue_id to clean up")
    p_complete.set_defaults(func=cmd_complete)

    # generate (full workflow)
    p_gen = subparsers.add_parser("generate", help="Full workflow in one command")
    p_gen.add_argument("--prompt", required=True, help="Audio description prompt")
    p_gen.add_argument("--lyrics", help="Optional lyrics text")
    p_gen.add_argument("--duration", type=int, help="Duration in seconds")
    p_gen.add_argument("--voice", help="Voice name")
    p_gen.add_argument("--speed", type=float, help="Speed multiplier (0.25-4.0)")
    p_gen.add_argument("--instrumental", action="store_true", help="Force instrumental (no vocals)")
    p_gen.add_argument("--output", default="output_audio.mp3", help="Output file path (default: output_audio.mp3)")
    p_gen.add_argument("--chars", type=int, help="Character count for quote pricing")
    p_gen.set_defaults(func=cmd_generate)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
