{{/* Resource name: the service name, so in-cluster DNS matches docker-compose. */}}
{{- define "aura-service.name" -}}
{{- default .Release.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "aura-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "aura-service.name" . }}
app.kubernetes.io/instance: {{ include "aura-service.name" . }}-{{ .Values.environment }}
{{- end -}}

{{- define "aura-service.labels" -}}
{{ include "aura-service.selectorLabels" . }}
app.kubernetes.io/part-of: the-aura-mind
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
environment: {{ .Values.environment }}
{{- end -}}

{{- define "aura-service.secretName" -}}
{{- default (printf "%s-secrets" (include "aura-service.name" .)) .Values.secretName -}}
{{- end -}}

{{- define "aura-service.probe" -}}
httpGet:
  path: {{ .path }}
  port: http
periodSeconds: {{ .cfg.periodSeconds }}
timeoutSeconds: {{ .cfg.timeoutSeconds }}
failureThreshold: {{ .cfg.failureThreshold }}
{{- end -}}
