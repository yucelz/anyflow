# Creating the PostgreSQL Database for N8N

The N8N configuration is working correctly, but the database "anyflowDB" needs to be created first.

## Quick Solution

### Option 1: Create Database via Command Line
If you have PostgreSQL client tools installed, run:

```bash
# Connect to PostgreSQL and create the database
psql -h localhost -U postgres -c "CREATE DATABASE anyflowDB;"
```

### Option 2: Create Database via Docker
If you're using a Docker PostgreSQL container:

```bash
# Connect to your PostgreSQL container and create the database
docker exec -it your-postgres-container-name psql -U postgres -c "CREATE DATABASE anyflowDB;"
```

### Option 3: Start a New PostgreSQL Docker Container
If you don't have PostgreSQL running yet:

```bash
# Start PostgreSQL with the database already created
docker run --name n8n-postgres \
  -e POSTGRES_DB=anyflowDB \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=admin123 \
  -p 5432:5432 \
  -d postgres:15
```

## Verification

After creating the database, test the connection:

```bash
psql -h localhost -U postgres -d anyflowDB -c "SELECT version();"
```

## Start N8N

Once the database exists, start N8N:

```bash
pnpm start:default
```

## Expected Success Output

You should see N8N start successfully and create its tables automatically:

```
Initializing n8n process
Database tables created successfully
n8n ready on 0.0.0.0, port 5678
```

## Current Configuration

Your `.env` file is configured with:
- Database: anyflowDB
- User: postgres
- Password: admin123
- Host: localhost
- Port: 5432

The N8N start script is properly loading these environment variables.
