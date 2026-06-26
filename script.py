import re

with open("components/GanttView.tsx", "r") as f:
    lines = f.readlines()

# find start and end of the block
start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if 'className="flex flex-row shrink-0 overflow-hidden pr-1 items-center h-full"' in line:
        start_idx = i - 1 # <div ... style={{width: nameWidth}}>
    if '{visibleColumns.predecessors && (' in line and start_idx != -1:
        # find the end of this block
        pass
    if '</>' in line and '</div>' in lines[i+1] and '<div className="relative flex-1 h-full flex items-center border-b border-slate-100">' in lines[i+2]:
        end_idx = i + 1
        break

print(f"start: {start_idx}, end: {end_idx}")

block = "".join(lines[start_idx:end_idx+1])
with open("tmp_block.tsx", "w") as f:
    f.write(block)
