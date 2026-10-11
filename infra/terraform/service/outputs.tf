output "image" {
  description = "Fully qualified image deployed."
  value       = "${local.image_repository}:${var.image_tag}"
}

output "helm_release" {
  description = "Helm release name, chart version and revision."
  value = {
    name     = helm_release.this.name
    chart    = "${helm_release.this.metadata[0].chart}-${helm_release.this.metadata[0].version}"
    revision = helm_release.this.metadata[0].revision
  }
}

output "service_dns" {
  description = "In-cluster DNS name of the service."
  value       = "${var.service_name}.${var.namespace}.svc.cluster.local:${var.container_port}"
}
