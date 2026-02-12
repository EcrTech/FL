

## Clean Up Test Lead

### Action
Delete the draft loan application created during the Meta UTM test so you can re-test without UTM parameters.

### Record to Delete
- **Table**: `loan_applications`
- **ID**: `137dcfb9-8d9b-4f8f-9da6-8d45c022f4e9`
- **Details**: Status `draft`, Stage `lead`, Source `Meta Ads`

### After Cleanup
Test URL without UTM parameters:
`https://id-preview--3dde44ee-dbff-485f-a3a3-07b86d234bf5.lovable.app/apply/ref/REF-MIUHLOTL`

The source should default to **"Direct"** since no UTM parameters are present.

