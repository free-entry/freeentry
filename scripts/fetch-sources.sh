#!/usr/bin/env bash
# Refresh the raw source fixtures used by tests and data curation.
#
# 1) data.gouv.fr — "Liste des musées franciliens (IDF)" (Licence Ouverte)
#    JSON resource. Structure: array of records; fields per record under `fields`:
#      nom_officiel_du_musee, adresse, lieu, code_postal, commune, departement,
#      region_administrative, latitude, longitude, geolocalisation [lat, lng],
#      identifiant_museofile, ref_deps, telephone, url,
#      date_arrete_attribution_appellation
#    133 records as of 2026-08-06; lat/lng/CP/commune/name present on all.
#
# 2) parisjetaime.com — free museums & monuments article. Relevant DOM:
#      <h2> section headings ("🎯 …") define free-access categories:
#        - "tous les jours, toute l'année"                        -> always
#        - "1er dimanche de chaque mois, toute l'année"           -> first-sunday
#        - "1er dimanche … du 1er octobre au 31 mars"             -> first-sunday (Oct–Mar)
#        - "1er dimanche … du 1er novembre au 31 mars"            -> first-sunday (Nov–Mar)
#        - "1er samedi du mois, du 1er octobre au 30 juin"        -> first-saturday (Oct–Jun)
#        - "une fois par mois en nocturne"                        -> nocturne
#        - "le 14 juillet"                                        -> july-14
#        - "pour les moins de 26 ans"                             -> under-26
#      Sections after "❓Questions fréquentes" (FAQ, offers, see-also) are ignored.
#      Museum cards: <div class="card"> … <h3|h4 class="title"><a href="…">Name</a>
#      with sibling .layout_highlight_address_info (street address).
#      Note: some venues listed are outside Île-de-France (Château de Pierrefonds,
#      Château de Compiègne) and are excluded by the curation skip-list.
set -euo pipefail
cd "$(dirname "$0")/fixtures"
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"

curl -sL --max-time 60 -A "$UA" \
  "https://www.data.gouv.fr/api/1/datasets/r/6c1502c9-5080-4138-a26f-cc2168042868" \
  -o datagouv-museums.json

curl -sL --max-time 90 -A "$UA" -H "Accept: text/html,application/xhtml+xml" \
  "https://parisjetaime.com/article/les-musees-et-monuments-gratuits-a-paris-a961" \
  -o parisjetaime.html

curl -sL --max-time 90 -A "$UA" \
  "https://www.monuments-nationaux.fr/trouver-un-monument" \
  -o cmn-list.html && echo "cmn-list.html: $(wc -c < cmn-list.html) bytes (parse with scripts/check-cmn.ts)"

echo "Fixtures refreshed: $(wc -c < datagouv-museums.json) bytes (data.gouv), $(wc -c < parisjetaime.html) bytes (parisjetaime)"
