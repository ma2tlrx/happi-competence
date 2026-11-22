#!/usr/bin/env python3
"""
Construit le SQL des tables rome_domains, rome_fiches et rome_fiche_savoir_etre
(migration 20261123090000_rome_reference.sql) à partir des fichiers OFFICIELS de
France Travail, téléchargés par l'administrateur et gardés HORS du dépôt :

  python3 -I scripts/rome/build-reference-sql.py \
      --arborescence  ~/telechargements/rome_arboprincipale-<date>.xlsx \
      --competences   ~/telechargements/arborescence-simplifiee-des-competences-<version>.xlsx \
      --sortie        /tmp/rome-reference.sql

Rien n'est inventé : chaque libellé, code et lien vient des fichiers. Le SQL produit est
rejouable (insert … on conflict do update) ; l'exécuter avec la clé de service ou dans
l'éditeur SQL de Supabase. Dépendance : openpyxl.
"""
import argparse
import re
import sys

import openpyxl


def cell(value):
    return value.strip() if isinstance(value, str) else ('' if value is None else str(value).strip())


def q(text):
    return "'" + text.replace("'", "''") + "'"


def code_part(value, width):
    """Partie numérique d'un code (« 6 » lu comme nombre devient « 06 »)."""
    text = cell(value)
    if text.endswith('.0'):
        text = text[:-2]
    return text.zfill(width) if text.isdigit() else text


def check(pattern, value, what):
    if not re.fullmatch(pattern, value):
        sys.exit(f'Code {what} inattendu : « {value} ». Fichier modifié ou mal lu : rien n’est généré.')
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--arborescence', required=True)
    parser.add_argument('--competences', required=True)
    parser.add_argument('--sortie', required=True)
    args = parser.parse_args()

    tree = openpyxl.load_workbook(args.arborescence, read_only=True)
    sheet = next((tree[name] for name in tree.sheetnames if name.lower().startswith('arbo principale')), None)
    if sheet is None:
        sys.exit('Feuille « Arbo Principale … » introuvable dans le fichier d’arborescence.')
    domains, subdomains, fiches = {}, {}, {}
    for row in sheet.iter_rows(min_row=2, values_only=True):
        row = list(row) + [None] * (4 - len(row))
        letter, two, fiche, label = cell(row[0]), code_part(row[1], 2), code_part(row[2], 2), cell(row[3])
        if not letter:
            continue
        if not label:
            sys.exit(f'Libellé manquant pour le code {letter}{two}{fiche}.')
        if not two:
            domains[check(r'[A-N]', letter, 'de grand domaine')] = label
        elif not fiche:
            subdomains[check(r'[A-N]\d{2}', letter + two, 'de domaine professionnel')] = label
        else:
            fiches.setdefault(check(r'[A-N]\d{4}', letter + two + fiche, 'de fiche'), []).append(label)
    if not domains or not subdomains or not fiches:
        sys.exit('Arborescence vide ou illisible : rien n’est généré.')

    comps = openpyxl.load_workbook(args.competences, read_only=True)
    macro = next((comps[name] for name in comps.sheetnames if name.lower().startswith('ref - macro')), None)
    if macro is None:
        sys.exit('Feuille « REF - Macro » introuvable dans le fichier des compétences.')
    rows = list(macro.iter_rows(values_only=True))
    header = [cell(h) for h in rows[0]]
    try:
        i_code, i_cat, i_list = header.index('Code Macro'), header.index('Catégorie'), header.index("Liste des fiches ROME mobilisant l'objet")
    except ValueError as missing:
        sys.exit(f'Colonne attendue absente : {missing}. Colonnes : {header}')
    links = []
    for row in rows[1:]:
        if cell(row[i_cat]) != 'Savoir-être professionnel':
            continue
        code = check(r'6D1\d{2}', cell(row[i_code]), 'de savoir-être')
        for fiche in re.split(r'[,\s]+', cell(row[i_list])):
            if fiche:
                links.append((fiche, code))

    unknown = sorted({fiche for fiche, _ in links if fiche not in fiches})
    if unknown:
        print(f'⚠ {len(unknown)} fiche(s) citée(s) par les savoir-être mais absente(s) de l’arborescence, ignorée(s) : {", ".join(unknown[:10])}…', file=sys.stderr)
    links = [(f, c) for f, c in links if f in fiches]
    if not links:
        sys.exit('Aucun lien fiche ↔ savoir-être lu : rien n’est généré.')

    out = ['-- Généré par scripts/rome/build-reference-sql.py ; ne pas modifier à la main.', 'begin;']
    out.append('insert into public.rome_domains (code, parent_code, label) values\n' + ',\n'.join(f'({q(c)}, null, {q(l)})' for c, l in sorted(domains.items())) + '\non conflict (code) do update set label = excluded.label;')
    out.append('insert into public.rome_domains (code, parent_code, label) values\n' + ',\n'.join(f'({q(c)}, {q(c[0])}, {q(l)})' for c, l in sorted(subdomains.items())) + '\non conflict (code) do update set label = excluded.label, parent_code = excluded.parent_code;')
    def arr(items):
        return 'array[' + ','.join(q(i) for i in items) + ']::text[]'
    out.append('insert into public.rome_fiches (code, subdomain_code, appellations) values\n' + ',\n'.join(f'({q(c)}, {q(c[:3])}, {arr(a)})' for c, a in sorted(fiches.items())) + '\non conflict (code) do update set subdomain_code = excluded.subdomain_code, appellations = excluded.appellations;')
    # Fiches et domaines retirés du ROME : supprimés (les liens suivent par cascade).
    out.append('delete from public.rome_fiches where code not in (' + ','.join(q(c) for c in sorted(fiches)) + ');')
    out.append('delete from public.rome_domains where char_length(code) = 3 and code not in (' + ','.join(q(c) for c in sorted(subdomains)) + ');')
    out.append('delete from public.rome_domains where char_length(code) = 1 and code not in (' + ','.join(q(c) for c in sorted(domains)) + ');')
    out.append('delete from public.rome_fiche_savoir_etre;')
    out.append('insert into public.rome_fiche_savoir_etre (fiche_code, savoir_etre_code) values\n' + ',\n'.join(f'({q(f)}, {q(c)})' for f, c in sorted(set(links))) + '\non conflict do nothing;')
    out.append('commit;')
    with open(args.sortie, 'w', encoding='utf-8') as handle:
        handle.write('\n'.join(out) + '\n')
    print(f'✔ {len(domains)} grands domaines, {len(subdomains)} domaines professionnels, {len(fiches)} fiches, {len(set(links))} liens fiche ↔ savoir-être → {args.sortie}')


if __name__ == '__main__':
    main()
