import argparse
import os
import shutil
import subprocess
from pathlib import Path

from scripts.patch_generated import patch_generated


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--compile-only", action="store_true")
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", default="7860")
    args = parser.parse_args()
    agent_directory = Path(__file__).resolve().parent
    unmute = shutil.which("unmute")
    if not unmute:
        raise SystemExit("Install Unmute 0.4.2 and put it on PATH.")
    subprocess.run([unmute, "validate", str(agent_directory)], check=True)
    subprocess.run([unmute, "compile", str(agent_directory), "--target", "pipecat"], check=True)
    build_directory = agent_directory / "build" / "pipecat"
    patch_generated(build_directory)
    if args.compile_only:
        return
    uv = shutil.which("uv")
    if not uv:
        raise SystemExit("Install uv and put it on PATH.")
    environment = {**os.environ, "UV_PROJECT_ENVIRONMENT": str(agent_directory / ".venv")}
    subprocess.run(
        [uv, "sync", "--group", "dev", "--python", "3.12", "--project", str(build_directory)],
        env=environment, check=True,
    )
    subprocess.run(
        [uv, "run", "--no-sync", "--project", str(build_directory), "python", "bot.py",
         "--transport", "webrtc", "--host", args.host, "--port", args.port],
        cwd=build_directory, env=environment, check=True,
    )


if __name__ == "__main__":
    main()
