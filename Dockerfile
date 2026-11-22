FROM node:22-alpine

WORKDIR /app

COPY bridge.mjs ./
COPY web ./web
COPY site ./site

ENV NODE_ENV=production \
    WEBIDE_HOST=0.0.0.0 \
    WEBIDE_PORT=47321 \
    WEBIDE_TRUST_PROXY=1

EXPOSE 47321

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.WEBIDE_PORT || 47321) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "bridge.mjs"]
