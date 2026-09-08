#!/usr/bin/env python3
import os
import re
from pathlib import Path

def remove_practical_advice_section(file_path):
    """Remove the '实战建议' section from a markdown file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content

    # Pattern to match ## 实战项目建议 section and everything until the next ## heading or end of file
    # This regex captures the section heading and all content until another ## or end of string
    pattern = r'\n## 实战项目建议\n.*?(?=\n## |\Z)'

    # Remove the section
    modified_content = re.sub(pattern, '', content, flags=re.DOTALL)

    # Check if content was modified
    if modified_content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(modified_content)
        return True
    return False

def main():
    base_path = Path('/Users/mac/ProjectStation/coder-path/docs/learning-paths')

    # Find all .md files
    md_files = list(base_path.rglob('*.md'))

    modified_count = 0
    modified_files = []

    for file_path in sorted(md_files):
        if remove_practical_advice_section(file_path):
            modified_count += 1
            modified_files.append(str(file_path.relative_to(base_path.parent)))
            print(f"✓ Modified: {file_path.relative_to(base_path.parent)}")
        else:
            print(f"- No change: {file_path.relative_to(base_path.parent)}")

    print(f"\n{'='*60}")
    print(f"Total files processed: {len(md_files)}")
    print(f"Files modified: {modified_count}")
    print(f"{'='*60}")

    if modified_files:
        print("\nModified files:")
        for f in modified_files:
            print(f"  - {f}")

if __name__ == '__main__':
    main()
