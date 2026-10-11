terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.17"
    }
  }

  # Partial configuration: bucket, key and region are supplied by the CI/CD
  # workflow with -backend-config so every <environment>/<service> pair gets
  # its own state file. use_lockfile enables native S3 state locking.
  backend "s3" {
    encrypt      = true
    use_lockfile = true
  }
}
