# The co-op relay (coop-relay.mjs, from Run Escape): plain Node, no packages.
# Players find each other in rooms here and the host's game reaches the
# guests through it. relay/README.md has the Fly.io steps.
FROM node:20-alpine
WORKDIR /app
COPY coop-relay.mjs client-ip.mjs name-gen.mjs ./
# Fly's proxy sits in front on a private address, so its X-Forwarded-For is
# believed (PROXY=local); rooms take anyone whatever maps they have (the game
# gates maps itself, by the host's progress); no metrics listener
ENV PORT=8787 PROXY=local MULTIPLAYER_ANY_MAP=on MULTIPLAYER_METRICS=off
EXPOSE 8787
CMD ["node", "coop-relay.mjs"]
