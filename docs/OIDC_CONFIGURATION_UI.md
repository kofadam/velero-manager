# OIDC Configuration Management via UI

## Overview

Velero Manager now supports managing OIDC/SSO configuration directly through the web UI settings page. This allows administrators to enable, configure, and test OIDC authentication without needing to modify environment variables or restart the application.

## Features

- **UI-based Configuration**: Configure OIDC settings through the Settings page
- **Secure Storage**: 
  - Non-sensitive configuration stored in Kubernetes ConfigMap
  - Client secret stored in Kubernetes Secret
- **Live Configuration Testing**: Test OIDC provider connectivity before saving
- **Hot Reload**: Configuration changes take effect without pod restarts
- **Role Mapping**: Map OIDC roles and groups to Velero Manager admin permissions

## Architecture

### Storage Components

1. **ConfigMap**: `velero-manager-oidc-config`
   - Stores all non-sensitive OIDC configuration
   - Includes issuer URL, client ID, claim mappings, role mappings

2. **Secret**: `velero-manager-oidc-secret`
   - Stores the OIDC client secret securely
   - Automatically created/updated when configuration is saved

### Configuration Flow

```
User (Admin) → Settings Page → API Endpoint → ConfigMap/Secret → Application Reload
```

## Setup Instructions

### 1. Prerequisites

- Kubernetes cluster with Velero Manager deployed
- Admin access to Velero Manager
- OIDC provider (Keycloak, Auth0, Okta, etc.) configured
- Client ID and Secret from your OIDC provider

### 2. Initial Deployment

Deploy the ConfigMap and Secret templates:

```bash
# Create namespace if not exists
kubectl create namespace velero-manager

# Deploy ConfigMap template (disabled by default)
kubectl apply -f k8s/oidc-configmap.yaml

# Deploy Secret template (placeholder)
kubectl apply -f k8s/oidc-secret.yaml
```

### 3. Configure via UI

1. **Navigate to Settings**
   - Log in to Velero Manager as admin
   - Go to Settings → OIDC / SSO tab

2. **Enable OIDC**
   - Toggle "Enable OIDC Authentication" switch

3. **Configure Identity Provider**
   - **Issuer URL**: Your OIDC provider's issuer URL
     - Keycloak: `https://keycloak.company.com/auth/realms/company`
     - Auth0: `https://company.auth0.com/`
     - Okta: `https://company.okta.com`
   
   - **Client ID**: The OAuth2 client ID for Velero Manager
   
   - **Client Secret**: The OAuth2 client secret (stored securely)
   
   - **Redirect URL**: Callback URL (auto-populated)
     - Default: `https://your-domain/api/v1/auth/oidc/callback`

4. **Test Connection**
   - Click "Test Connection" to verify OIDC provider connectivity
   - Ensures the issuer URL is reachable and valid

5. **Configure Claim Mappings** (Optional)
   - **Username Claim**: JWT claim for username (default: `preferred_username`)
   - **Email Claim**: JWT claim for email (default: `email`)
   - **Full Name Claim**: JWT claim for display name (default: `name`)
   - **Roles Claim**: JWT claim path for roles (default: `realm_access.roles`)
   - **Groups Claim**: JWT claim for groups (default: `groups`)

6. **Configure Admin Role Mapping**
   - **Admin Roles**: OIDC roles that grant admin access
     - Add roles like `velero-admin`, `platform-admin`
   - **Admin Groups**: OIDC groups that grant admin access
     - Add groups like `velero-administrators`, `devops`
   - **Default Role**: Role for authenticated users without admin mapping (default: `user`)

7. **Save Configuration**
   - Click "Save Configuration"
   - Application will reload configuration automatically

## OIDC Provider Setup

### Keycloak Configuration

1. Create a new client in your Keycloak realm:
   ```
   Client ID: velero-manager
   Client Protocol: openid-connect
   Access Type: confidential
   Valid Redirect URIs: https://velero-manager.company.com/api/v1/auth/oidc/callback
   ```

2. Configure client scopes:
   - `openid` (required)
   - `email` (recommended)
   - `profile` (recommended)
   - `groups` (if using group-based access)

3. Create roles:
   - `velero-admin` - For administrator access
   - `velero-user` - For standard user access

4. Map users/groups to roles as needed

### Auth0 Configuration

1. Create a new Regular Web Application
2. Set Allowed Callback URLs
3. Configure Rules for role/group mapping

### Okta Configuration

1. Create a new Web application
2. Configure Sign-in redirect URIs
3. Set up Groups claim in the authorization server

## API Endpoints

The following endpoints are available for OIDC configuration management:

### Get Current Configuration
```http
GET /api/v1/oidc/config
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "enabled": false,
  "issuerURL": "https://keycloak.company.com/auth/realms/company",
  "clientID": "velero-manager",
  "clientSecret": "****",
  "redirectURL": "https://velero-manager.company.com/api/v1/auth/oidc/callback",
  "usernameClaim": "preferred_username",
  "emailClaim": "email",
  "fullNameClaim": "name",
  "rolesClaim": "realm_access.roles",
  "groupsClaim": "groups",
  "adminRoles": ["velero-admin", "admin"],
  "adminGroups": ["velero-administrators"],
  "defaultRole": "user"
}
```

### Update Configuration
```http
PUT /api/v1/oidc/config
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "enabled": true,
  "issuerURL": "https://keycloak.company.com/auth/realms/company",
  "clientID": "velero-manager",
  "clientSecret": "your-secret",
  ...
}
```

### Test Connection
```http
POST /api/v1/oidc/test
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "issuerURL": "https://keycloak.company.com/auth/realms/company",
  "clientID": "velero-manager",
  "clientSecret": "your-secret"
}
```

## Security Considerations

1. **Secret Management**
   - Client secrets are stored in Kubernetes Secrets
   - Never exposed in ConfigMaps or logs
   - Transmitted encrypted over HTTPS

2. **Access Control**
   - Only admin users can modify OIDC configuration
   - Configuration changes are audited in Kubernetes events

3. **Validation**
   - OIDC provider connectivity tested before saving
   - Invalid configurations rejected with clear error messages

## Troubleshooting

### OIDC Not Working After Configuration

1. **Check ConfigMap**:
   ```bash
   kubectl get configmap velero-manager-oidc-config -n velero-manager -o yaml
   ```

2. **Check Secret**:
   ```bash
   kubectl get secret velero-manager-oidc-secret -n velero-manager -o yaml
   ```

3. **Check Pod Logs**:
   ```bash
   kubectl logs -n velero-manager deployment/velero-manager
   ```

### Connection Test Fails

1. **Network Issues**:
   - Ensure OIDC provider is reachable from the cluster
   - Check firewall rules and network policies

2. **Invalid Issuer URL**:
   - Verify the issuer URL is correct
   - Try accessing `<issuer-url>/.well-known/openid-configuration` directly

3. **Client Configuration**:
   - Verify client ID and secret are correct
   - Check client is enabled in OIDC provider

### Users Can't Login

1. **Role Mapping**:
   - Verify users have the correct roles/groups in OIDC provider
   - Check admin roles/groups configuration in Velero Manager

2. **Claim Mapping**:
   - Verify claim paths are correct for your OIDC provider
   - Check JWT token contents using jwt.io or similar tools

## Migration from Environment Variables

If you're currently using environment variables for OIDC configuration:

1. Deploy the application with ConfigMap/Secret support
2. Access the Settings page
3. Enter your current OIDC configuration
4. Save and test
5. Remove environment variables from deployment

## Best Practices

1. **Test in Staging**: Always test OIDC configuration changes in a staging environment first
2. **Backup Configuration**: Export ConfigMap/Secret before making changes
3. **Monitor Logs**: Watch application logs during configuration changes
4. **Document Mappings**: Keep documentation of role/group mappings
5. **Regular Testing**: Periodically test OIDC connectivity and authentication flow

## Support

For issues or questions about OIDC configuration:
1. Check the troubleshooting section above
2. Review application logs
3. Open an issue on GitHub with:
   - OIDC provider type and version
   - Error messages
   - Configuration (without secrets)
   - Log excerpts