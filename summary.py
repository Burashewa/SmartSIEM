import argparse
import time
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.columns import Columns
from rich.layout import Layout
from alert_writer import writer

console = Console()

SEVERITY_COLORS = {
    "CRITICAL": "bold red",
    "HIGH": "bold yellow",
    "MEDIUM": "yellow",
    "LOW": "dim green"
}

def render_summary(severity_filter=None, last_n=100):
    console.clear()
    
    all_alerts = writer.read_all()
    
    # Compute stats from file, because writer.stats() is in-memory for the current process only
    stats = {
        "by_severity": {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0},
        "by_rule": {}
    }
    for a in all_alerts:
        sev = a.get("severity", "LOW")
        stats["by_severity"][sev] = stats["by_severity"].get(sev, 0) + 1
        rid = a.get("rule_id", "Unknown")
        stats["by_rule"][rid] = stats["by_rule"].get(rid, 0) + 1
        
    if severity_filter:
        all_alerts = [a for a in all_alerts if a.get("severity") == severity_filter]
        
    # Get last N and reverse for most recent first
    recent_alerts = list(reversed(all_alerts))[:last_n]
    
    # 1. Four severity stat cards
    cards = []
    for sev in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
        count = stats["by_severity"].get(sev, 0)
        color = SEVERITY_COLORS.get(sev, "white")
        cards.append(Panel(f"[{color}]{count}[/]", title=sev, expand=False))
        
    console.print(Columns(cards))
    console.print()
    
    # 2. Alert table
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Time", style="dim", width=12)
    table.add_column("Severity")
    table.add_column("Rule ID")
    table.add_column("Rule Name")
    table.add_column("IP")
    table.add_column("Message")
    table.add_column("Status")
    
    for a in recent_alerts:
        sev = a.get("severity", "LOW")
        color = SEVERITY_COLORS.get(sev, "white")
        
        # Take just HH:MM:SS from ISO
        # E.g., 2026-03-22T17:24:06+00:00 -> split T -> [1] -> :8 -> 17:24:06
        time_str = a.get("trigger_time", "").split("T")[-1][:8]
        
        table.add_row(
            time_str,
            f"[{color}]{sev}[/]",
            a.get("rule_id", ""),
            a.get("rule_name", ""),
            str(a.get("ip", "")),
            a.get("message", ""),
            a.get("status", "")
        )
        
    console.print(Panel(table, title=f"Recent Alerts (Total: {len(all_alerts)})", expand=False))
    console.print()
    
    # 3. Rule hit count
    rule_table = Table(show_header=True)
    rule_table.add_column("Rule ID")
    rule_table.add_column("Hits")
    
    for r_id, count in sorted(stats["by_rule"].items()):
        rule_table.add_row(r_id, str(count))
        
    console.print(Panel(rule_table, title="Rule Hits", expand=False))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--severity", help="Filter by severity")
    parser.add_argument("--last", type=int, default=100, help="Number of recent alerts to show")
    parser.add_argument("--watch", action="store_true", help="Refresh every 3s")
    args = parser.parse_args()
    
    if args.watch:
        try:
            while True:
                render_summary(args.severity, args.last)
                time.sleep(3)
        except KeyboardInterrupt:
            pass
    else:
        render_summary(args.severity, args.last)

if __name__ == "__main__":
    main()
