#!/usr/bin/env bash
set -euo pipefail

URL="https://github.com/thibault60000/agents-house/releases/latest/download/maison-des-agents_amd64.deb"

main() {
  if [ "$(uname -m)" != "x86_64" ]; then
    echo "Agents House n'existe que pour les processeurs x86_64." >&2
    exit 1
  fi
  if ! command -v apt-get >/dev/null 2>&1; then
    echo "Ce script a besoin d'apt : il est prévu pour Ubuntu et Debian." >&2
    exit 1
  fi

  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' EXIT
  chmod 755 "$dir"

  echo "Téléchargement de Agents House..."
  wget -q --show-progress -O "$dir/maison-des-agents.deb" "$URL"
  chmod 644 "$dir/maison-des-agents.deb"

  echo "Installation (mot de passe administrateur demandé)..."
  sudo apt-get install -y "$dir/maison-des-agents.deb" </dev/null

  echo
  echo "C'est installé : ouvre Agents House depuis tes applications."
  if ! command -v claude >/dev/null 2>&1; then
    echo "Claude Code est introuvable : sans lui, l'app reste en mode démo."
    echo "Installation : https://claude.com/product/claude-code"
  fi
}

main "$@"
