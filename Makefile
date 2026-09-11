# Makefile voor Mirador del Mar vertaalpipeline

.PHONY: all scan sync export help

all: scan sync export

scan:
	@echo "[INFO] Scannen van HTML en genereren/updaten van modulaire taalbestanden..."
	node html-to-lang.js en

sync:
	@echo "[INFO] Delta-synchronisatie via cache en vertalen via DeepL..."
	node sync-from-files.js

export:
	@echo "[INFO] Exporteren van actuele vertalingen naar translations_for_sheets.csv (Backup/Overzicht)..."
	node export-to-csv.js

help:
	@echo "Beschikbare commando's:"
	@echo "  make scan   - Genereert basisbestanden en placeholders in alle .js bestanden vanuit HTML"
	@echo "  make sync   - Detecteert gewijzigde/nieuwe Engelse bronteksten en vertaalt via DeepL"
	@echo "  make export - Maakt een overzichtelijke CSV-dump van alle huidige .js bestanden"
	@echo "  make all    - Voert de complete pipeline uit: scan -> sync -> export"
