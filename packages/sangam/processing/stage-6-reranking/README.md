The problem: sorting by popularity_score descending for each category shows a terrible ranking.
- e.g. stackoverflow css and google analytics / cloud blog should not be top 5 for software engineering.
- we can't have like 20 variations of the same feed in the list. 

things to try:
- improve the core popularity score prompt. think abt what it should really be used for.
- i.e. it might be better to predefine top 50 per category for en and zh to avoid new random feeds getting into the top