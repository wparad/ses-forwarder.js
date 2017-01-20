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

### Service Permssions

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
              "Resource": "arn:aws:ses:*:*:*"
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