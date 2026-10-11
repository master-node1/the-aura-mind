# ── Environment (environments/<env>.tfvars.json) ─────────────────────────────

variable "environment" {
  description = "Deployment environment name (dev, staging, prod)."
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region hosting the EKS cluster and ECR registry."
  type        = string
}

variable "cluster_name" {
  description = "Name of the existing EKS cluster to deploy into."
  type        = string
}

variable "namespace" {
  description = "Existing Kubernetes namespace the service is deployed into."
  type        = string
}

variable "ecr_repository_prefix" {
  description = "ECR repository prefix; the image is <account>.dkr.ecr.<region>.amazonaws.com/<prefix>/<service>."
  type        = string
  default     = "the-aura-mind"
}

variable "common_env" {
  description = "Non-secret environment variables applied to every service in this environment."
  type        = map(string)
  default     = {}
}

variable "min_replicas" {
  description = "Minimum pod count (HPA floor)."
  type        = number
  default     = 1

  validation {
    condition     = var.min_replicas >= 1
    error_message = "min_replicas must be at least 1."
  }
}

variable "max_replicas" {
  description = "Maximum pod count (HPA ceiling)."
  type        = number
  default     = 3
}

# ── Service (services/<service>.tfvars.json) ─────────────────────────────────

variable "service_name" {
  description = "Service name; matches the directory under services/ and the ECR repository name."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,40}[a-z0-9]$", var.service_name))
    error_message = "service_name must be a DNS-1123 label (lowercase letters, digits, hyphens)."
  }
}

variable "image_tag" {
  description = "Container image tag to deploy (the git commit SHA built by CI)."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.image_tag))
    error_message = "image_tag must be a valid Docker tag."
  }
}

variable "container_port" {
  description = "Port the container listens on (also exported as PORT)."
  type        = number
}

variable "health_check_path" {
  description = "HTTP path used for startup, readiness and liveness probes."
  type        = string
}

variable "env" {
  description = "Service-specific non-secret environment variables (override common_env)."
  type        = map(string)
  default     = {}
}

variable "secret_name" {
  description = "Existing Kubernetes Secret injected via envFrom (DATABASE_URL, JWT_SECRET, ...). Defaults to <service>-secrets. Secrets are managed outside Terraform so they never land in state."
  type        = string
  default     = null
}

variable "cpu_request" {
  type    = string
  default = "100m"
}

variable "cpu_limit" {
  type    = string
  default = "500m"
}

variable "memory_request" {
  type    = string
  default = "256Mi"
}

variable "memory_limit" {
  type    = string
  default = "512Mi"
}

variable "target_cpu_utilization" {
  description = "Average CPU utilisation (%) the HPA scales on."
  type        = number
  default     = 70
}

variable "run_as_non_root" {
  description = "Enforce a non-root container. Enable only for images that define a non-root USER."
  type        = bool
  default     = false
}

variable "service_type" {
  description = "Kubernetes Service type (ClusterIP for internal services, LoadBalancer for the edge gateway)."
  type        = string
  default     = "ClusterIP"

  validation {
    condition     = contains(["ClusterIP", "LoadBalancer"], var.service_type)
    error_message = "service_type must be ClusterIP or LoadBalancer."
  }
}

variable "service_annotations" {
  description = "Annotations for the Kubernetes Service (e.g. AWS Load Balancer Controller settings)."
  type        = map(string)
  default     = {}
}
