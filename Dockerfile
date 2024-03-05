# Use an official Node.js runtime as the base image
FROM node:19-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy your bot's source code into the container
COPY . .

# Install dependencies
RUN npm install

# Command to start your bot
CMD ["node", "calendarbot.js"]
