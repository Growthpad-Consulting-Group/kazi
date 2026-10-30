UPDATE users
SET avatar_url = regexp_replace(avatar_url, '=s[0-9]+(-c)?$', '=s512-c')
WHERE avatar_url ~ '(^|/)lh[0-9]+\.googleusercontent\.com/'
  AND avatar_url ~ '=s[0-9]+(-c)?$';
