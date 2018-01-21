# SES Email forwarder
This is a Node based lambda to forward emails from SES to your account.

## Recent Changes
Visit the [changelog](CHANGELOG.md).

## Prerequisites

* Install NodeJS (4.3 this is what lambda uses) & npm
  ```bash
  curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
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

### Service Permssions
[Amazon full permission examples](http://docs.aws.amazon.com/ses/latest/DeveloperGuide/control-user-access.html) are available for restricting send email as SMTP users.
   ```json
   {
      "Version": "2012-10-17",
      "Statement": [
          {
              "Action": [
                  "s3:*"
              ],
              "Effect": "Allow",
              "Resource": "arn:aws:s3:::email.bucket/*"
          },
          {
              "Action": [
                  "ses:SendRawEmail"
              ],
              "Effect": "Allow",
              "Resource": "arn:aws:ses:*:*:identity/no-reply@DOMAIN_NAME"
          },
          {
              "Effect": "Allow",
              "Resource": "arn:aws:logs:*:*:*",
              "Action": [
                  "logs:CreateLogGroup",
                  "logs:CreateLogStream",
                  "logs:PutLogEvents"
              ]
          }
      ]
  }
  ```

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