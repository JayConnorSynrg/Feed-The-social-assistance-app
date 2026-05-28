FROM node:22-alpine

WORKDIR /app

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Copy pipeline scripts and dependencies
COPY program-discovery.ts federal-forms.ts state-portals.ts tsconfig.json package.json ./

# Install runtime dependencies only
RUN npm install

ENTRYPOINT ["tsx", "program-discovery.ts"]
