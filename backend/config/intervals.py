"""Reads the timing settings from watchdog.toml (path overridable with WATCHDOG_CONFIG)."""
import tomllib
from pathlib import Path

DEFAULTS = {("cve_feed", "poll_seconds"): 60, ("cve_feed", "lookback_minutes"): 60, ("vm_scan", "interval_seconds"): 600}


def load(path):
    """{(section, key): positive int}; a missing file or key falls back to DEFAULTS."""
    path = Path(path)
    cfg = tomllib.loads(path.read_text()) if path.is_file() else {}
    out = {}
    for (section, key), default in DEFAULTS.items():
        value = cfg.get(section, {}).get(key, default)
        if type(value) is not int or value <= 0:
            raise ValueError(f"{path}: [{section}] {key} must be a positive whole number, got {value!r}")
        out[section, key] = value
    return out


if __name__ == "__main__":  # self-check
    import tempfile
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "w.toml"
        assert load(p) == DEFAULTS
        p.write_text("[vm_scan]\ninterval_seconds = 30\n")
        assert load(p)["vm_scan", "interval_seconds"] == 30 and load(p)["cve_feed", "poll_seconds"] == 60
        for bad in ("0", "-5", "1.5", '"60"', "true"):
            p.write_text(f"[cve_feed]\npoll_seconds = {bad}\n")
            try:
                load(p)
                raise AssertionError(bad)
            except ValueError:
                pass
    print("ok")
