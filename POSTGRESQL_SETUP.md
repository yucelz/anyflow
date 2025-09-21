# N8N PostgreSQL Configuration

This document explains how to configure N8N to use a remote Docker PostgreSQL database using environment variables.

## Configuration

The N8N start script has been modified to load environment variables from the `.env` file. The PostgreSQL configuration is now handled through the following environment variables:

### Environment Variables

Edit the `.env` file in the root directory and update the PostgreSQL configuration:

```bash
# PostgreSQL Database Configuration
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=your-postgres-host
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=your-username
DB_POSTGRESDB_PASSWORD=your-password
DB_POSTGRESDB_SCHEMA=public
```

### Variable Descriptions

- `DB_TYPE`: Set to `postgresdb` to use PostgreSQL
- `DB_POSTGRESDB_HOST`: The hostname or IP address of your PostgreSQL server
- `DB_POSTGRESDB_PORT`: The port number (default: 5432)
- `DB_POSTGRESDB_DATABASE`: The database name
- `DB_POSTGRESDB_USER`: The database username
- `DB_POSTGRESDB_PASSWORD`: The database password
- `DB_POSTGRESDB_SCHEMA`: The database schema (default: public)

## Docker PostgreSQL Example

If you're using a Docker PostgreSQL container, you can start it with:

```bash
docker run --name n8n-postgres \
  -e POSTGRES_DB=n8n \
  -e POSTGRES_USER=n8n \
  -e POSTGRES_PASSWORD=n8n_password \
  -p 5432:5432 \
  -d postgres:15
```

Then update your `.env` file:

```bash
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n
DB_POSTGRESDB_PASSWORD=n8n_password
DB_POSTGRESDB_SCHEMA=public
```

## Remote PostgreSQL Example

For a remote PostgreSQL server:

```bash
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=your-remote-server.com
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=your-username
DB_POSTGRESDB_PASSWORD=your-secure-password
DB_POSTGRESDB_SCHEMA=public
```

## Creating the Database

Before starting N8N, ensure the PostgreSQL database exists. If you get an error like `database "anyflowDB" does not exist`, create it first:

### Option 1: Using psql command line
```bash
psql -h localhost -U postgres -c "CREATE DATABASE anyflowDB;"
```

### Option 2: Using Docker container
```bash
docker exec -it your-postgres-container-name psql -U postgres -c "CREATE DATABASE anyflowDB;"
```

### Option 3: Start fresh PostgreSQL container with database
```bash
docker run --name n8n-postgres \
  -e POSTGRES_DB=anyflowDB \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=admin123 \
  -p 5432:5432 \
  -d postgres:15
```

## Starting N8N

After configuring the environment variables and creating the database, start N8N using:

```bash
npm run start
```

Or directly:

```bash
pnpm start:default
```

The modified `start:default` script will:
1. Use bash to ensure compatibility with the `source` command
2. Load environment variables from the `.env` file using `set -a && source .env && set +a`
3. Start N8N with the PostgreSQL configuration

**Note:** The script uses bash explicitly to handle environment variable loading properly across different shell environments.

## Verification

To verify the configuration is working:

1. Check the N8N startup logs for database connection messages
2. Look for any PostgreSQL-related errors in the console
3. Ensure N8N creates the necessary database tables on first startup

## Troubleshooting

### Common Issues

1. **Connection refused**: Check if PostgreSQL is running and accessible
2. **Authentication failed**: Verify username and password
3. **Database does not exist**: Create the database before starting N8N
4. **Permission denied**: Ensure the user has proper permissions on the database

### Testing Connection

You can test the PostgreSQL connection using:

```bash
psql -h your-host -p 5432 -U your-username -d n8n
```

## Security Notes

- Never commit sensitive credentials to version control
- Use strong passwords for production environments
- Consider using connection pooling for high-traffic scenarios
- Enable SSL/TLS for remote connections when possible
