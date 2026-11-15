"""eleven0zero timing. After editing, apply with: docker compose restart"""
CVE_POLL_SEC = 60        # how often to check cve.org for new CVEs
CVE_LOOKBACK_MIN = 60    # on start, also evaluate CVEs published in the last N minutes
VM_SCAN_SEC = 600        # how often to re-collect every VM's inventory over SSH

for _name, _value in dict(CVE_POLL_SEC=CVE_POLL_SEC, CVE_LOOKBACK_MIN=CVE_LOOKBACK_MIN, VM_SCAN_SEC=VM_SCAN_SEC).items():
    if type(_value) is not int or _value <= 0:
        raise ValueError(f"config.py: {_name} must be a positive whole number, got {_value!r}")
