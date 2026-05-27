-- Migre la syntaxe cloze {{c<n>::X}} (Anki) vers <<X>> (flash_wiki).
-- Idempotente : si appliquée plusieurs fois, ne re-touche pas le contenu deja migre
-- (le pattern ne matche pas les <<X>>).

UPDATE cards
SET front = regexp_replace(front, '\{\{c[0-9]+::([^}]+)\}\}', '<<\1>>', 'g'),
    back  = regexp_replace(back,  '\{\{c[0-9]+::([^}]+)\}\}', '<<\1>>', 'g')
WHERE type = 'cloze'
  AND (front LIKE '%{{c%' OR back LIKE '%{{c%');
