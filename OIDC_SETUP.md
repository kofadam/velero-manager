# OIDC Authentication Setup with Corporate Keycloak

This guide explains how to configure Velero Manager to use OIDC authentication with your corporate Keycloak instance.

## 🔧 Configuration Overview

Velero Manager supports both legacy username/password authentication and OIDC authentication with Keycloak. When OIDC is enabled, it becomes the primary authentication method while legacy auth remains as fallback.

## 🚀 Keycloak Setup

### 1. Create Keycloak Client

1. **Access Keycloak Admin Console**
   ```
   https://your-keycloak.company.com/auth/admin/
   ```

2. **Create New Client**
   - **Client ID**: `velero-manager`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `confidential`
   - **Standard Flow**: `Enabled`
   - **Direct Access Grants**: `Disabled`
   - **Authorization**: `Disabled`

3. **Configure Valid Redirect URIs**
   ```
   http://localhost:3000/auth/callback
   https://velero-manager.company.com/auth/callback
   ```

4. **Configure Web Origins**
   ```
   http://localhost:3000
   https://velero-manager.company.com
   ```

5. **Get Client Secret**
   - Go to **Credentials** tab
   - Copy the **Secret** value

### 2. Configure User Roles/Groups

#### Option A: Using Realm Roles
1. **Create Realm Roles**:
   - `velero-admin` (for admin access)
   - `velero-user` (for regular user access)

2. **Assign Roles to Users**:
   - Go to **Users** → Select user → **Role Mappings**
   - Assign appropriate realm roles

#### Option B: Using Groups
1. **Create Groups**:
   - `velero-administrators` (for admin access)
   - `velero-users` (for regular user access)

2. **Assign Users to Groups**:
   - Go to **Users** → Select user → **Groups**
   - Join appropriate groups

### 3. Configure Client Scopes (Optional)

1. **Create Custom Scope for Groups** (if using groups):
   - **Name**: `groups`
   - **Protocol**: `openid-connect`
   - **Include in Token Scope**: `On`

2. **Add Groups Mapper**:
   - **Mapper Type**: `Group Membership`
   - **Token Claim Name**: `groups`
   - **Full group path**: `Off`

## 🔐 Environment Configuration

Set the following environment variables on your Velero Manager deployment:

### Required OIDC Variables

```bash
# Enable OIDC authentication
OIDC_ENABLED=true

# Keycloak configuration
OIDC_ISSUER_URL=https://your-keycloak.company.com/auth/realms/your-realm
OIDC_CLIENT_ID=velero-manager
OIDC_CLIENT_SECRET=your-client-secret-from-keycloak
OIDC_REDIRECT_URL=https://velero-manager.company.com/auth/callback
```

### Optional Configuration Variables

```bash
# Role mapping configuration
OIDC_ROLES_CLAIM=realm_access.roles              # JWT claim containing roles
OIDC_GROUPS_CLAIM=groups                         # JWT claim containing groups
OIDC_ADMIN_ROLES=velero-admin,admin              # Keycloak roles that map to admin
OIDC_ADMIN_GROUPS=velero-administrators,administrators # Keycloak groups that map to admin
OIDC_DEFAULT_ROLE=user                           # Default role for authenticated users

# User info mapping
OIDC_USERNAME_CLAIM=preferred_username           # Claim for username
OIDC_EMAIL_CLAIM=email                          # Claim for email
OIDC_FULL_NAME_CLAIM=name                       # Claim for full name
```

## 🐳 Docker Deployment Example

### docker-compose.yml
```yaml
version: '3.8'
services:
  velero-manager:
    image: your-registry/velero-manager:latest
    ports:
      - "8080:8080"
    environment:
      # OIDC Configuration
      OIDC_ENABLED: "true"
      OIDC_ISSUER_URL: "https://keycloak.company.com/auth/realms/company"
      OIDC_CLIENT_ID: "velero-manager"
      OIDC_CLIENT_SECRET: "${OIDC_CLIENT_SECRET}"
      OIDC_REDIRECT_URL: "https://velero-manager.company.com/auth/callback"
      
      # Role Mapping
      OIDC_ADMIN_ROLES: "velero-admin,realm-admin"
      OIDC_ADMIN_GROUPS: "velero-administrators"
      OIDC_DEFAULT_ROLE: "user"
    volumes:
      - ~/.kube:/root/.kube:ro
    restart: unless-stopped
```

### .env file
```bash
OIDC_CLIENT_SECRET=your-secret-key-here
```

## ☸️ Kubernetes Deployment Example

### ConfigMap
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: velero-manager-oidc-config
  namespace: velero-manager
data:
  OIDC_ENABLED: "true"
  OIDC_ISSUER_URL: "https://keycloak.company.com/auth/realms/company"
  OIDC_CLIENT_ID: "velero-manager"
  OIDC_REDIRECT_URL: "https://velero-manager.company.com/auth/callback"
  OIDC_ADMIN_ROLES: "velero-admin,realm-admin"
  OIDC_ADMIN_GROUPS: "velero-administrators"
  OIDC_DEFAULT_ROLE: "user"
```

### Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: velero-manager-oidc-secret
  namespace: velero-manager
type: Opaque
stringData:
  OIDC_CLIENT_SECRET: "your-secret-key-here"
```

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: velero-manager
  namespace: velero-manager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: velero-manager
  template:
    metadata:
      labels:
        app: velero-manager
    spec:
      containers:
      - name: velero-manager
        image: your-registry/velero-manager:latest
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: velero-manager-oidc-config
        - secretRef:
            name: velero-manager-oidc-secret
        volumeMounts:
        - name: kubeconfig
          mountPath: /root/.kube
          readOnly: true
      volumes:
      - name: kubeconfig
        secret:
          secretName: velero-manager-kubeconfig
```

## 🔄 Authentication Flow

### 1. OIDC Authentication Flow

1. **User accesses Velero Manager**
2. **Frontend detects OIDC enabled** via `/api/v1/auth/info`
3. **User clicks "Login with SSO"**
4. **Frontend calls** `/api/v1/auth/oidc/login`
5. **Backend redirects** to Keycloak authorization endpoint
6. **User authenticates** with corporate credentials
7. **Keycloak redirects** to `/api/v1/auth/oidc/callback`
8. **Backend validates** ID token and extracts user info
9. **Backend returns** JWT token and user details
10. **Frontend stores** JWT token for API calls

### 2. API Authentication

All API calls include the JWT token:
```bash
curl -H "Authorization: Bearer <jwt-token>" \
     https://velero-manager.company.com/api/v1/backups
```

## 🔍 API Endpoints

### Authentication Endpoints

- `GET /api/v1/auth/info` - Get auth configuration and current user info
- `POST /api/v1/auth/login` - Legacy username/password login
- `GET /api/v1/auth/oidc/login` - Initiate OIDC login flow
- `GET /api/v1/auth/oidc/callback` - Handle OIDC callback
- `POST /api/v1/auth/logout` - Logout (provides OIDC logout URL)

### Example API Response

```json
{
  "oidc_enabled": true,
  "legacy_auth_enabled": true,
  "authenticated": true,
  "user": {
    "username": "john.doe",
    "email": "john.doe@company.com",
    "full_name": "John Doe",
    "role": "admin",
    "auth_method": "oidc",
    "oidc_roles": ["velero-admin", "user"],
    "oidc_groups": ["velero-administrators", "developers"]
  }
}
```

## 🛠️ Role Mapping Configuration

### Flexible Role Mapping

The system supports flexible mapping from Keycloak roles/groups to Velero Manager roles:

**Admin Access** - Users with any of these conditions get `admin` role:
- Has any role listed in `OIDC_ADMIN_ROLES`
- Member of any group listed in `OIDC_ADMIN_GROUPS`

**User Access** - All authenticated users get the `OIDC_DEFAULT_ROLE` (default: `user`)

### Example Configurations

#### Configuration 1: Realm Roles Only
```bash
OIDC_ROLES_CLAIM=realm_access.roles
OIDC_ADMIN_ROLES=velero-admin,backup-admin
OIDC_DEFAULT_ROLE=user
```

#### Configuration 2: Groups Only
```bash
OIDC_GROUPS_CLAIM=groups
OIDC_ADMIN_GROUPS=velero-administrators,platform-team
OIDC_DEFAULT_ROLE=user
```

#### Configuration 3: Mixed (Roles + Groups)
```bash
OIDC_ROLES_CLAIM=realm_access.roles
OIDC_GROUPS_CLAIM=groups
OIDC_ADMIN_ROLES=velero-admin
OIDC_ADMIN_GROUPS=platform-administrators
OIDC_DEFAULT_ROLE=user
```

## 🔐 Security Best Practices

### 1. Token Security
- JWT tokens are valid for 24 hours
- ID tokens are stored for frontend OIDC logout
- Session fallback tokens are cleaned automatically

### 2. HTTPS Requirements
- Always use HTTPS in production
- Configure proper SSL certificates
- Set secure redirect URLs

### 3. Client Secret Protection
- Store client secret in environment variables or Kubernetes secrets
- Rotate client secret periodically
- Use different secrets for different environments

## 🐛 Troubleshooting

### Common Issues

#### 1. "Invalid redirect URI" Error
**Cause**: Redirect URI in request doesn't match Keycloak client configuration
**Solution**: Verify `OIDC_REDIRECT_URL` matches Keycloak client's Valid Redirect URIs

#### 2. "Failed to verify ID token" Error
**Cause**: Token verification failed (wrong client ID or expired token)
**Solution**: Check `OIDC_CLIENT_ID` matches Keycloak client configuration

#### 3. "No admin access" Error
**Cause**: User roles/groups don't match admin configuration
**Solution**: Verify user has roles/groups listed in `OIDC_ADMIN_ROLES`/`OIDC_ADMIN_GROUPS`

#### 4. "OIDC provider initialization failed" Error
**Cause**: Cannot connect to Keycloak or wrong issuer URL
**Solution**: Verify `OIDC_ISSUER_URL` is accessible and correct

### Debug Information

Check logs for authentication details:
```bash
docker logs velero-manager | grep -i oidc
kubectl logs deployment/velero-manager | grep -i oidc
```

Enable verbose logging:
```bash
export GIN_MODE=debug
```

### Health Checks

Test OIDC connectivity:
```bash
# Test issuer URL accessibility
curl https://your-keycloak.company.com/auth/realms/your-realm/.well-known/openid_configuration

# Test auth info endpoint
curl https://velero-manager.company.com/api/v1/auth/info
```

## 📝 Migration from Legacy Auth

### Gradual Migration Strategy

1. **Deploy with OIDC enabled** but continue allowing legacy auth
2. **Train users** on new OIDC login process
3. **Monitor usage** via logs and authentication methods
4. **Disable legacy auth** once all users have migrated

### Backward Compatibility

- Legacy JWT tokens remain valid during transition
- Existing user accounts in Kubernetes secrets are preserved
- API endpoints remain unchanged (just authentication method changes)

---

**Need Help?** Check the [main documentation](README.md) or open an issue in the repository.