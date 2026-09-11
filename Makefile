.PHONY: all sync export

all: sync

export:
	node export-to-csv.js
	@if [ -f translations-master.csv ]; then \
		mv translations-master.csv translations-master.csv.bak; \
	fi
	mv translations_for_sheets.csv translations-master.csv

sync:
	node sync-from-csv.js
