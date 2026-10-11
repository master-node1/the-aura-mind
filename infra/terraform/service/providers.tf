provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "the-aura-mind"
      Environment = var.environment
      Service     = var.service_name
      ManagedBy   = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}

data "aws_eks_cluster" "this" {
  name = var.cluster_name
}

data "aws_eks_cluster_auth" "this" {
  name = var.cluster_name
}

provider "helm" {
  kubernetes {
    host                   = data.aws_eks_cluster.this.endpoint
    cluster_ca_certificate = base64decode(data.aws_eks_cluster.this.certificate_authority[0].data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}
