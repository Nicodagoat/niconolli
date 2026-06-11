#!/usr/bin/env python3
"""Genera il token OAuth per Google Calendar (metodo GOOGLE_AUTH_METHOD=oauth).

Prerequisiti:
1. Su Google Cloud Console creare un progetto e abilitare "Google Calendar API".
2. Creare credenziali OAuth 2.0 di tipo "Desktop app" e scaricare il JSON
   in secrets/oauth_client.json (o nel percorso GOOGLE_OAUTH_CLIENT_SECRETS).
3. Eseguire questo script su una macchina con browser:
       python scripts/google_oauth_setup.py
   Si aprirà il browser per autorizzare l'account niccolonolli@gmail.com.
   Il token viene salvato in secrets/oauth_token.json e poi rinnovato
   automaticamente dal servizio.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google_auth_oauthlib.flow import InstalledAppFlow

from src.config import settings
from src.google_calendar import SCOPES


def main() -> int:
    client_secrets = settings.google_oauth_client_secrets
    if not client_secrets.exists():
        print(
            f"ERRORE: client OAuth non trovato in {client_secrets}.\n"
            "Scarica il JSON delle credenziali 'Desktop app' da Google Cloud "
            "Console e salvalo in quel percorso (vedi README).",
            file=sys.stderr,
        )
        return 1

    flow = InstalledAppFlow.from_client_secrets_file(str(client_secrets), SCOPES)
    credentials = flow.run_local_server(port=0)

    token_file = settings.google_oauth_token_file
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(credentials.to_json())
    print(f"Token salvato in {token_file}")
    print("Ora puoi avviare il servizio con GOOGLE_AUTH_METHOD=oauth")
    return 0


if __name__ == "__main__":
    sys.exit(main())
