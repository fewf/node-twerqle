.PHONY: all realAll clean

# The following fake "all" target silences make's
# "Nothing to be done for `all'" message.

all: realAll
	@true

realAll: static/bundle.js

SCRIPTS = $(shell find script -maxdepth 2 -name "*.js")

static/bundle.js: $(SCRIPTS)
	browserify script/main.js -o bundle.js

clean:
	rm static/bundle.js
