import argparse
import shutil
from pathlib import Path

AGENT_DIRECTORY = Path(__file__).resolve().parents[1]


def patch_generated(build_directory: Path) -> None:
    bot_file = build_directory / "bot.py"
    source = bot_file.read_text(encoding="utf-8")
    if "from compass_session import" in source:
        raise ValueError("Compile a fresh Unmute build before applying the runtime adapters.")
    replacements = {
        "from pipecat_slng import SlngSTTService":
            "from slng_stt_batched import BatchedSlngSTTService\n"
            "from compass_session import recommendation_session, recommendation_tools, session_prompt",
        "return SlngSTTService(": "return BatchedSlngSTTService(",
        "system_instruction=COMPASS_PROMPT,": "system_instruction=COMPASS_PROMPT + session_prompt(),",
        "        await _run_bot(transport, runner_args, dev)":
            "        async with recommendation_session(transport, runner_args):\n"
            "            await _run_bot(transport, runner_args, dev)",
        "import tools.recommend_titles": "import tools.recommendations",
        "import tools.refine_recommendations\n": "",
        "import tools.get_content_details\n": "",
        "tools.recommend_titles.recommend_titles(": "tools.recommendations.recommend_titles(",
        "tools.refine_recommendations.refine_recommendations(": "tools.recommendations.refine_recommendations(",
        "tools.get_content_details.get_content_details(": "tools.recommendations.get_content_details(",
        "tools=[end_call, recommend_titles, refine_recommendations, get_content_details]":
            "tools=[end_call, *recommendation_tools()]",
    }
    for old, new in replacements.items():
        if source.count(old) != 1:
            raise ValueError(f"Unexpected Unmute output: expected one {old!r}. Use Unmute 0.4.2.")
        source = source.replace(old, new)
    for filename in ("slng_stt_batched.py", "compass_session.py"):
        shutil.copy2(AGENT_DIRECTORY / "runtime" / filename, build_directory / filename)
    shutil.copy2(
        AGENT_DIRECTORY / "tools" / "recommendations.py",
        build_directory / "tools" / "recommendations.py",
    )
    for name in ("recommend_titles", "refine_recommendations", "get_content_details"):
        shutil.copy2(AGENT_DIRECTORY / "tools" / f"{name}.yaml", build_directory / "tools" / f"{name}.yaml")
    bot_file.write_text(source, encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("build_directory", type=Path)
    patch_generated(parser.parse_args().build_directory)
