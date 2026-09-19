# models/train_models.py
# Launches every training script in this folder, one after another.
import subprocess
import sys
from pathlib import Path

MODELS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = MODELS_DIR.parent


def discover_scripts() -> list[Path]:
    return sorted(
        p for p in MODELS_DIR.glob("*.py")
        if p.name not in {"__init__.py", Path(__file__).name}
        and not p.name.startswith("test_")
    )


def run_all() -> int:
    scripts = discover_scripts()
    if not scripts:
        print("No training scripts found.")
        return 0

    failures = []
    for script in scripts:
        print(f"\n{'=' * 60}\nRunning {script.name}\n{'=' * 60}")
        result = subprocess.run([sys.executable, str(script)], cwd=BACKEND_DIR)
        if result.returncode != 0:
            failures.append(script.name)
            print(f"-> {script.name} FAILED (exit {result.returncode})")

    print(f"\n{'=' * 60}")
    print(f"Completed {len(scripts) - len(failures)}/{len(scripts)} scripts.")
    if failures:
        print("Failed:", ", ".join(failures))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_all())
