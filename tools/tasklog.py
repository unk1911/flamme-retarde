#!/usr/bin/env python3
"""
TASKLOG.md minutes from evidence, not from memory.

The `min` column was being filled in by whoever finished the task, from their
impression of how long it took, and impressions are what the log exists to
replace (see TASKLOG.md's header). This works it out from timestamps that
already exist:

  start   --start PATH        a file or directory whose mtime is the start
                              (an agent's scratchpad dir, a first output file)
          --start ISO         "2026-10-02 18:07" or "2026-10-02T18:07:30-04:00"
          --since-commit SHA  that commit's time (e.g. the commit the task
                              branched from, or main's tip when it began)
  end     --end ISO | now | head | SHA
                              default: HEAD's commit time if it is after the
                              start (the task's own commit), otherwise now
  or      --agent-ms MS       an agent's usage block `duration_ms`, which is
                              the best evidence there is, when there is one

Prints the minutes. To write them:

  --fix-last                  rewrite the last row's `min`
  --row TEXT                  …or the last row whose cells contain TEXT
                              (e.g. its result, "1.583.0") instead
  --calls N                   also set `calls`
  --runs N                    also set `runs`
  --dry-run                   print the row as it would be, write nothing

Examples:

  tools/tasklog.py --start $SCRATCH                      # minutes so far
  tools/tasklog.py --since-commit cb39289 --fix-last
  tools/tasklog.py --agent-ms 1563000 --calls 116 --row 1.583.0

Every other byte of the file is left alone: the row is split on its pipes and
put back together the same way, and the tool refuses to touch a file whose
rows do not round-trip.
"""

import argparse
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COLS = ['date', 'task', 'who', 'pipe', 'kind', 'min', 'calls', 'runs', 'result']


def git_time(ref, cwd):
    out = subprocess.run(['git', 'show', '-s', '--format=%cI', ref], cwd=cwd,
                         capture_output=True, text=True)
    if out.returncode:
        sys.exit(f'tasklog: no such commit: {ref}')
    return datetime.fromisoformat(out.stdout.strip())


def parse_time(s, cwd, what):
    if s == 'now':
        return datetime.now(timezone.utc)
    if s == 'head':
        return git_time('HEAD', cwd)
    if os.path.exists(s):
        return datetime.fromtimestamp(os.path.getmtime(s), timezone.utc)
    try:
        t = datetime.fromisoformat(s)
        return t if t.tzinfo else t.astimezone()           # naive = local time
    except ValueError:
        pass
    if re.fullmatch(r'[0-9a-fA-F]{4,40}', s):
        return git_time(s, cwd)
    sys.exit(f'tasklog: cannot read a time from {what} {s!r}')


def fmt_min(m):
    # The log's own style: whole minutes, one decimal under ten.
    return f'{m:.1f}'.rstrip('0').rstrip('.') if m < 10 else str(int(round(m)))


def split_row(line):
    if not (line.startswith('| ') and line.endswith(' |')):
        return None
    cells = line[2:-2].split(' | ')
    return cells if len(cells) == len(COLS) else None


def join_row(cells):
    return '| ' + ' | '.join(cells) + ' |'


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--start')
    ap.add_argument('--since-commit')
    ap.add_argument('--end')
    ap.add_argument('--agent-ms', type=float)
    ap.add_argument('--fix-last', action='store_true')
    ap.add_argument('--row')
    ap.add_argument('--calls')
    ap.add_argument('--runs')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--file', default=os.path.join(ROOT, 'TASKLOG.md'))
    ap.add_argument('--repo', default=ROOT, help='where git is asked (default: this checkout)')
    a = ap.parse_args()

    if a.agent_ms is not None:
        minutes = a.agent_ms / 60000
        how = f'agent duration_ms {int(a.agent_ms)}'
    else:
        if a.since_commit:
            t0 = git_time(a.since_commit, a.repo)
            how0 = f'commit {a.since_commit}'
        elif a.start:
            t0 = parse_time(a.start, a.repo, '--start')
            how0 = a.start
        else:
            ap.error('give --start, --since-commit or --agent-ms')
        if a.end:
            t1 = parse_time(a.end, a.repo, '--end')
            how1 = a.end
        else:
            head = git_time('HEAD', a.repo)
            t1, how1 = (head, 'HEAD') if head > t0 else (datetime.now(timezone.utc), 'now')
        minutes = (t1 - t0).total_seconds() / 60
        how = f'{how0} {t0.astimezone():%Y-%m-%d %H:%M:%S} -> {how1} {t1.astimezone():%Y-%m-%d %H:%M:%S}'
        if minutes < 0:
            sys.exit(f'tasklog: the end is before the start ({how})')

    print(f'{fmt_min(minutes)} min  ({minutes:.2f}; {how})')
    if not (a.fix_last or a.row):
        return

    text = open(a.file, encoding='utf-8').read()
    lines = text.split('\n')
    rows = [i for i, l in enumerate(lines) if split_row(l) and not re.fullmatch(r'\|(-+\|)+', l)
            and split_row(l)[0] != 'date']
    for i in rows:
        if join_row(split_row(lines[i])) != lines[i]:
            sys.exit(f'tasklog: line {i + 1} does not round-trip; not touching the file')
    if a.row:
        pick = [i for i in rows if any(a.row in c for c in split_row(lines[i]))]
        if not pick:
            sys.exit(f'tasklog: no row contains {a.row!r}')
        i = pick[-1]
    else:
        if not rows:
            sys.exit('tasklog: no rows')
        i = rows[-1]
    cells = split_row(lines[i])
    before = dict(zip(COLS, cells))
    cells[COLS.index('min')] = fmt_min(minutes)
    if a.calls is not None:
        cells[COLS.index('calls')] = str(a.calls)
    if a.runs is not None:
        cells[COLS.index('runs')] = str(a.runs)
    new = join_row(cells)
    print(f'line {i + 1} ({before["result"]}): min {before["min"]} -> {cells[5]}, '
          f'calls {before["calls"]} -> {cells[6]}, runs {before["runs"]} -> {cells[7]}')
    if a.dry_run:
        print(new[:200] + ('…' if len(new) > 200 else ''))
        return
    lines[i] = new
    open(a.file, 'w', encoding='utf-8').write('\n'.join(lines))


if __name__ == '__main__':
    main()
