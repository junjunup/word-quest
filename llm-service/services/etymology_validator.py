"""
Cycle 4: 词源事实校验器
校验 AI 生成的词源解释，标记可疑/未验证的词根声明
"""

import re

# 已验证的高频词根库（CET-4/6 常见词根，可扩展）
KNOWN_ROOTS = {
    # 拉丁词根
    "spect": ("look, see", "Latin specere"),
    "dict": ("say, speak", "Latin dicere"),
    "port": ("carry", "Latin portare"),
    "scribe": ("write", "Latin scribere"),
    "script": ("write", "Latin scribere"),
    "struct": ("build", "Latin struere"),
    "tract": ("pull, draw", "Latin trahere"),
    "rupt": ("break", "Latin rumpere"),
    "ject": ("throw", "Latin jacere"),
    "duct": ("lead", "Latin ducere"),
    "duce": ("lead", "Latin ducere"),
    "mit": ("send", "Latin mittere"),
    "miss": ("send", "Latin mittere"),
    "vert": ("turn", "Latin vertere"),
    "vers": ("turn", "Latin vertere"),
    "voc": ("call, voice", "Latin vocare"),
    "vok": ("call, voice", "Latin vocare"),
    "clud": ("close, shut", "Latin claudere"),
    "clus": ("close, shut", "Latin claudere"),
    "ced": ("go, yield", "Latin cedere"),
    "cess": ("go, yield", "Latin cedere"),
    "tend": ("stretch", "Latin tendere"),
    "tens": ("stretch", "Latin tendere"),
    "tain": ("hold", "Latin tenere"),
    "ten": ("hold", "Latin tenere"),
    "capt": ("take, seize", "Latin capere"),
    "cept": ("take, seize", "Latin capere"),
    "fac": ("make, do", "Latin facere"),
    "fact": ("make, do", "Latin facere"),
    "fect": ("make, do", "Latin facere"),
    "pend": ("hang, weigh", "Latin pendere"),
    "pens": ("hang, weigh", "Latin pendere"),
    "sens": ("feel", "Latin sentire"),
    "sent": ("feel", "Latin sentire"),
    "vid": ("see", "Latin videre"),
    "vis": ("see", "Latin videre"),
    "aud": ("hear", "Latin audire"),
    "mot": ("move", "Latin movere"),
    "mob": ("move", "Latin movere"),
    "mov": ("move", "Latin movere"),
    "grad": ("step, go", "Latin gradi"),
    "gress": ("step, go", "Latin gradi"),
    "cred": ("believe, trust", "Latin credere"),
    "bene": ("good, well", "Latin bene"),
    "mal": ("bad", "Latin malus"),
    "multi": ("many", "Latin multus"),
    "omni": ("all", "Latin omnis"),
    "pre": ("before", "Latin prae"),
    "post": ("after", "Latin post"),
    "sub": ("under", "Latin sub"),
    "super": ("above, over", "Latin super"),
    "trans": ("across", "Latin trans"),
    "inter": ("between", "Latin inter"),
    "circum": ("around", "Latin circum"),
    "contra": ("against", "Latin contra"),
    "semi": ("half", "Latin semi"),
    "equi": ("equal", "Latin aequus"),

    # 希腊词根
    "graph": ("write, draw", "Greek graphein"),
    "gram": ("write, draw", "Greek gramma"),
    "log": ("word, study", "Greek logos"),
    "logue": ("speech", "Greek logos"),
    "logy": ("study of", "Greek logia"),
    "path": ("feeling, disease", "Greek pathos"),
    "phil": ("love", "Greek philos"),
    "phob": ("fear", "Greek phobos"),
    "phon": ("sound", "Greek phone"),
    "photo": ("light", "Greek photos"),
    "scope": ("see, examine", "Greek skopein"),
    "tele": ("far, distant", "Greek tele"),
    "therm": ("heat", "Greek therme"),
    "bio": ("life", "Greek bios"),
    "geo": ("earth", "Greek ge"),
    "hydro": ("water", "Greek hydor"),
    "chron": ("time", "Greek chronos"),
    "dem": ("people", "Greek demos"),
    "crat": ("rule, power", "Greek kratos"),
    "arch": ("rule, chief", "Greek arkhein"),
    "auto": ("self", "Greek autos"),
    "micro": ("small", "Greek mikros"),
    "macro": ("large", "Greek makros"),
    "poly": ("many", "Greek polys"),
    "mono": ("one, single", "Greek monos"),
    "pseudo": ("false", "Greek pseudes"),
    "psych": ("mind, soul", "Greek psykhe"),
    "techn": ("skill, art", "Greek tekhne"),
    "theo": ("god", "Greek theos"),
    "anti": ("against", "Greek anti"),
    "syn": ("together, with", "Greek syn"),
    "sym": ("together, with", "Greek syn"),
    "peri": ("around", "Greek peri"),
    "hyper": ("over, excessive", "Greek hyper"),
    "hypo": ("under", "Greek hypo"),

    # 盎格鲁-撒克逊/古英语常见词根
    "un": ("not", "Old English un-"),
    "re": ("again, back", "Latin re-"),
    "dis": ("not, opposite", "Latin dis-"),
    "mis": ("wrong, bad", "Old English mis-"),
    "over": ("excessive", "Old English ofer"),
    "under": ("beneath, insufficient", "Old English under"),
    "fore": ("before, front", "Old English fore"),
    "out": ("beyond, external", "Old English ut"),
    "en": ("make, put into", "Old French en-"),
    "em": ("make, put into", "Old French em-"),
    "able": ("capable of", "Latin -abilis"),
    "ible": ("capable of", "Latin -ibilis"),
    "ful": ("full of", "Old English -full"),
    "less": ("without", "Old English -leas"),
    "ness": ("state of", "Old English -nes"),
    "tion": ("act of, state of", "Latin -tio"),
    "sion": ("act of, state of", "Latin -sio"),
    "ment": ("result of", "Latin -mentum"),
    "ance": ("state of", "Latin -antia"),
    "ence": ("state of", "Latin -entia"),
    "ist": ("one who", "Latin -ista"),
    "er": ("one who", "Old English -ere"),
    "or": ("one who", "Latin -or"),
    "ive": ("tending to", "Latin -ivus"),
    "al": ("relating to", "Latin -alis"),
    "ic": ("relating to", "Greek -ikos"),
    "ous": ("full of", "Latin -osus"),
    "ize": ("make, become", "Greek -izein"),
    "ise": ("make, become", "Greek -izein"),
    "ify": ("make", "Latin -ificare"),
}


class EtymologyValidator:
    """词源事实校验器"""

    # 常见词根命名模式
    ROOT_PATTERN = re.compile(
        r'\b([a-z]{3,12})\b\s*(?:源自|来自|来源于|from|Latin|Greek|French|Old English)',
        re.IGNORECASE
    )

    def extract_roots(self, text: str) -> dict:
        """从 AI 解释文本中提取声称的词根"""
        claimed = {}
        for match in self.ROOT_PATTERN.finditer(text):
            root = match.group(1).lower()
            if root not in claimed:
                claimed[root] = match.group(0)
        return claimed

    def validate(self, word: str, ai_explanation: str) -> dict:
        """
        验证 AI 词源解释的可靠性
        返回 { is_fully_valid, valid_roots, suspect_roots, confidence, verdict }
        """
        claimed_roots = self.extract_roots(ai_explanation)
        if not claimed_roots:
            return {
                "is_fully_valid": True,
                "valid_roots": {},
                "suspect_roots": {},
                "confidence": 1.0,
                "verdict": "no_roots_claimed"
            }

        valid = {}
        suspect = {}
        for root, claim in claimed_roots.items():
            if root in KNOWN_ROOTS:
                valid[root] = {"claim": claim, "known": KNOWN_ROOTS[root]}
            else:
                suspect[root] = claim

        total = len(claimed_roots)
        conf = len(valid) / total if total > 0 else 1.0

        return {
            "is_fully_valid": len(suspect) == 0,
            "valid_roots": valid,
            "suspect_roots": suspect,
            "confidence": round(conf, 2),
            "verdict": "all_verified" if len(suspect) == 0 else "partial_verified" if len(valid) > 0 else "none_verified"
        }

    def get_correction_hint(self, suspect_root: str) -> str:
        """为可疑词根提供修正建议"""
        # 尝试模糊匹配已知词根
        if suspect_root in KNOWN_ROOTS:
            meaning, origin = KNOWN_ROOTS[suspect_root]
            return f'"{suspect_root}" 是已验证词根: {meaning} ({origin})'

        # 查找相似词根
        similar = []
        for known_root in KNOWN_ROOTS:
            if self._is_similar(suspect_root, known_root):
                meaning, origin = KNOWN_ROOTS[known_root]
                similar.append(f'"{known_root}" ({meaning}, {origin})')

        if similar:
            return f'未找到"{suspect_root}"的验证信息。可能你想用的是: {"; ".join(similar[:3])}'
        return f'"{suspect_root}" 不在已验证词根库中，建议核实后再使用。'

    def _is_similar(self, a: str, b: str, threshold: int = 2) -> bool:
        """简单编辑距离判断相似性"""
        if abs(len(a) - len(b)) > threshold:
            return False
        # 前缀匹配
        min_len = min(len(a), len(b))
        match = sum(1 for i in range(min_len) if a[i] == b[i])
        return match >= min_len - 1
