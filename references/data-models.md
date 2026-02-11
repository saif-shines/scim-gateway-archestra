Okta sends

```json
{
  "spec_version": "1",
  "id": "evt_111962867057559304",
  "type": "organization.directory.user_created",
  "occurred_at": "2026-02-11T09:31:09.190748Z",
  "environment_id": "env_111951842212053263",
  "organization_id": "org_111960706403795990",
  "object": "DirectoryUser",
  "data": {
    "active": true,
    "dp_id": "00u1010p7z3iTcjOG698",
    "email": "saif.shines@hey.com",
    "family_name": "Shines",
    "given_name": "Saif",
    "groups": null,
    "id": "diruser_111962867007293192",
    "locale": "en-US",
    "name": "Saif Shines",
    "organization_id": "org_111960706403795990",
    "preferred_username": "saif.shines@hey.com",
    "raw_attributes": {
      "active": true,
      "displayName": "Saif Shines",
      "emails": [
        {
          "primary": true,
          "type": "work",
          "value": "saif.shines@hey.com"
        }
      ],
      "externalId": "00u1010p7z3iTcjOG698",
      "groups": [],
      "locale": "en-US",
      "name": {
        "familyName": "Shines",
        "givenName": "Saif"
      },
      "schemas": [
        "urn:ietf:params:scim:schemas:core:2.0:User"
      ],
      "userName": "saif.shines@hey.com"
    },
    "roles": [
      {
        "role_name": "member"
      }
    ]
  },
  "display_name": ""
}
```

A.AI

/api/roles



/api/organization
 - need ot store this id as external_id with scalekit
 - external_id should be used to render the page

 