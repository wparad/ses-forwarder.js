# SES Email forwarder
This is a Node based lambda to forward emails from SES to your account.

## Recent Changes
Visit the [changelog](CHANGELOG.md).

## Prerequisites
* Install NodeJS

### Building

  ```bash
    npm install
    npm build
  ```
### Deployment

  ```bash
    npm install
    npm build
    npm deploy
  ```

### AWS Setup
* Add SES sender email address which matches the sender you want to use in the ses-forwarder configuration.

### Add a new alias (email user)
* Use the STMP credentials menu in SES
* Update the policy to match

```json
    {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": "ses:SendRawEmail",
                "Resource": "*",
                "Condition": {
                    "StringEqualsIgnoreCase": {
                        "ses:FromAddress": [
                            "email-address@DOMAIN_NAME.COM"
                        ]
                    }
                }
            }
        ]
    }
```