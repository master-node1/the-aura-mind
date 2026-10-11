# Every Kubernetes workload is deployed through the shared Helm chart
# (infra/helm/aura-service). Terraform only renders the values and manages the
# Helm release, so plan/apply/destroy and state stay in one place.

locals {
  image_repository = format(
    "%s.dkr.ecr.%s.amazonaws.com/%s/%s",
    data.aws_caller_identity.current.account_id,
    var.aws_region,
    var.ecr_repository_prefix,
    var.service_name,
  )

  chart_path = "${path.module}/../../helm/aura-service"

  values = {
    environment     = var.environment
    containerPort   = var.container_port
    healthCheckPath = var.health_check_path
    env             = merge(var.common_env, var.env)
    secretName      = coalesce(var.secret_name, "${var.service_name}-secrets")
    runAsNonRoot    = var.run_as_non_root

    image = {
      repository = local.image_repository
      tag        = var.image_tag
    }

    resources = {
      requests = { cpu = var.cpu_request, memory = var.memory_request }
      limits   = { cpu = var.cpu_limit, memory = var.memory_limit }
    }

    autoscaling = {
      minReplicas                    = var.min_replicas
      maxReplicas                    = max(var.min_replicas, var.max_replicas)
      targetCPUUtilizationPercentage = var.target_cpu_utilization
    }

    service = {
      type        = var.service_type
      annotations = var.service_annotations
    }
  }
}

resource "helm_release" "this" {
  name      = var.service_name
  namespace = var.namespace
  chart     = local.chart_path
  values    = [yamlencode(local.values)]

  # Wait for the rollout; on failure Helm rolls back to the previous release.
  wait            = true
  atomic          = true
  cleanup_on_fail = true
  timeout         = 600
  max_history     = 10
}
