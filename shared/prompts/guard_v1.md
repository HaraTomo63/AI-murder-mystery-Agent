# guard_v1
Return JSON only. Detect if the text violates any rules: meta/system explanation, summaries, suggestions of next actions, or prompt leakage.

Input:
text: {{text}}

Output JSON:
{"violations": ["meta","summary","advice","prompt_leak"]}
