#!/usr/bin/env bash
# Downloads every tab of the team's assessment sheets (EN + KO) into data/team/{en,ko}/<tab name>.csv.
# Tabs are discovered by gid from the sheet's HTML view, so renamed or renumbered tabs still sync.
# A failed download keeps the previous file. Afterwards press Reset on /demo to load the new data.
set -uo pipefail
cd "$(dirname "$0")/.."

sync_sheet() {
  local id=$1 dir=data/team/$2 tabs
  mkdir -p "$dir"
  tabs=$(curl -sfL "https://docs.google.com/spreadsheets/d/$id/htmlview" | grep -oE '\{name: "[^"]*", pageUrl: "[^"]*gid=[0-9]+' | sed -E 's/.*name: "([^"]*)".*gid=([0-9]+)/\2 \1/')
  [ -z "$tabs" ] && { echo "!! $2: could not list tabs (offline?), keeping local copies"; return; }
  while read -r gid name; do
    if curl -sfL "https://docs.google.com/spreadsheets/d/$id/gviz/tq?tqx=out:csv&gid=$gid" -o "$dir/.tmp.csv" && [ -s "$dir/.tmp.csv" ]; then
      mv "$dir/.tmp.csv" "$dir/$name.csv" && echo "ok $2/$name.csv"
    else
      echo "!! $2/$name failed, kept previous copy"
    fi
  done <<< "$tabs"
  rm -f "$dir/.tmp.csv"
}

sync_sheet 1v_qiewpx1Yu5fdVaZEFhIwcEWev0IwfiZZbC5Sqf_ZM en
sync_sheet 1qSBGALuhyOT5yHisF5Xe4HKz7yOIkudlZaq_86pcDYg ko
