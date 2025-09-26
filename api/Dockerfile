FROM node:18-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package.json .
# Install only production dependencies
RUN npm install --only=prod

# Copy the rest of the source code
COPY . .

# Expose the port the app runs on
ENV PORT=3001
EXPOSE 3001

# Start the server
CMD ["node", "index.js"]