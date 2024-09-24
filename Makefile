BUN = bun
SRC = src/cli/index.ts
OUTFILE = cosmogovern

install:
	$(BUN) install

build:
	$(BUN) build $(SRC) --compile --outfile=$(OUTFILE)

clean:
	rm -f $(OUTFILE)

all: install build

.PHONY: install build clean all

