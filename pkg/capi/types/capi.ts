export const CAPI_PRODUCT_NAME = 'capi-turtles';

export const BLANK_CLUSTER = '_';

export const LABELS = { AUTO_IMPORT: 'cluster-api.cattle.io/rancher-auto-import' };

export const CAPI = {
  CLUSTER_CLASS: 'cluster.x-k8s.io.clusterclass',
  PROVIDER:      'operator.cluster.x-k8s.io.infrastructureprovider',
};

export const CP_VERSIONS = {
  'kubekey-k3s': ['k3s1', 'k3s2'],
  rke2:          ['rke2r1', 'rke2r2']
};

export const CREDENTIALS_UPDATE_REQUIRED = ['aks'];
export const CREDENTIALS_NOT_REQUIRED = ['docker'];
export interface Worker {
  name: string,
  class: string
}

export interface ResourceReferece {
  apiVersion?: string,
  fieldPath?: string,
  kind?: string,
  name?: string,
  namespace?: string,
  resourceVersion?: string,
  uid?: string
}

export interface CAPIClusterTopology {
    version: string,
    class: string,
    workers: {
      machineDeployments: Worker[],
      machinePools: Worker[]
    }
}
export interface CAPIClusterCPEndpoint {
  host: string,
  port: Number
}

export interface CAPIClusterNetwork {
  apiServerPort?: Number,
  pods?: {
    cidrBlocks: string[]
  },
  serviceDomain?: string,
  services?: {
    cidrBlocks: string[]
  },
}

export interface ClusterClass {
  metadata: {
    name: string,
    annotations: {
      [key: string]: string
    }
  },
  spec: {
    infrastructure: {
      ref: ResourceReferece
    },
    workers?: {
      machineDeployments?: any[],
      machinePools?: any[],
    }
    controlPlane?: any
  }
}

export interface InfrastructureProvider {
  metadata: {
    name: string,
    annotations: Object
  }
}
