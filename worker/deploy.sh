#!/usr/bin/env bash
# Builds the worker image, pushes it to Amazon ECR and creates/updates the Lambda function.
# Needs: Docker running, AWS CLI v2 signed in (aws configure / aws sso login).
#   ./worker/deploy.sh                       # defaults below
#   MEMORY=3008 REGION=eu-west-1 ./worker/deploy.sh
set -euo pipefail

FUNCTION="${FUNCTION:-fries-profile-worker}"
REGION="${REGION:-$(aws configure get region 2>/dev/null || true)}"
REGION="${REGION:-us-east-1}"
# More memory = more vCPUs = faster. 10240 MB gives 6 vCPUs. New AWS accounts are capped at 3008 MB
# until you request a quota increase (Service Quotas > Lambda); the script falls back automatically.
MEMORY="${MEMORY:-10240}"
REPO="fries-profile-worker"
ROLE="fries-profile-worker-role"
HERE="$(cd "$(dirname "$0")" && pwd)"

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
IMAGE="$REGISTRY/$REPO:$(date +%Y%m%d%H%M%S)"
echo "Account $ACCOUNT, region $REGION, function $FUNCTION"

aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" >/dev/null
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

# --provenance=false: Lambda rejects the multi-manifest images buildx makes by default.
docker build --platform linux/amd64 --provenance=false -t "$IMAGE" "$HERE"
docker push "$IMAGE"

if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "Creating execution role $ROLE"
  aws iam create-role --role-name "$ROLE" --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  sleep 10 # IAM is eventually consistent
fi
ROLE_ARN="$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)"

if aws lambda get-function --function-name "$FUNCTION" --region "$REGION" >/dev/null 2>&1; then
  echo "Updating $FUNCTION"
  aws lambda update-function-code --function-name "$FUNCTION" --image-uri "$IMAGE" --region "$REGION" >/dev/null
else
  echo "Creating $FUNCTION ($MEMORY MB)"
  create() {
    aws lambda create-function --function-name "$FUNCTION" --region "$REGION" \
      --package-type Image --code "ImageUri=$IMAGE" --role "$ROLE_ARN" --architectures x86_64 \
      --memory-size "$1" --timeout 600 --ephemeral-storage Size=2048 >/dev/null
  }
  if ! create "$MEMORY"; then
    echo "Could not create with $MEMORY MB (likely the account's memory quota); retrying with 3008 MB."
    create 3008
  fi
fi
aws lambda wait function-updated-v2 --function-name "$FUNCTION" --region "$REGION" 2>/dev/null \
  || aws lambda wait function-active-v2 --function-name "$FUNCTION" --region "$REGION"

# Async invocations: retry a crashed job once, drop jobs older than 15 minutes (the guest has moved on).
aws lambda put-function-event-invoke-config --function-name "$FUNCTION" --region "$REGION" \
  --maximum-retry-attempts 1 --maximum-event-age-in-seconds 900 >/dev/null

FN_ARN="$(aws lambda get-function --function-name "$FUNCTION" --region "$REGION" --query Configuration.FunctionArn --output text)"
cat <<MSG

Deployed $FN_ARN

Next, in the Amplify console:
  1. Hosting > Environment variables:  WORKER_LAMBDA_FUNCTION=$FUNCTION  WORKER_AWS_REGION=$REGION
  2. Let the app invoke it. Either attach this policy to the app's compute role (App settings > IAM roles),
     or to an IAM user whose keys you set as WORKER_AWS_ACCESS_KEY_ID / WORKER_AWS_SECRET_ACCESS_KEY:
     {"Version":"2012-10-17","Statement":[{"Effect":"Allow",
       "Action":["lambda:InvokeFunction","lambda:GetFunctionConfiguration"],"Resource":"$FN_ARN"}]}
  3. Redeploy, then check /api/health -> "worker".
MSG
