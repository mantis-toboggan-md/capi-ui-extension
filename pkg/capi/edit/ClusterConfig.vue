<script lang='ts'>
import { defineComponent } from 'vue';
import CreateEditView from '@shell/mixins/create-edit-view';
import CruResource from '@shell/components/CruResource.vue';
import Loading from '@shell/components/Loading.vue';
import FormValidation from '@shell/mixins/form-validation';
import LabeledSelect from '@shell/components/form/LabeledSelect.vue';
import NameNsDescription from '@shell/components/form/NameNsDescription.vue';
import RadioGroup from '@components/Form/Radio/RadioGroup.vue';
import LabeledInput from '@components/Form/LabeledInput/LabeledInput.vue';
import LabelValue from '@shell/components/LabelValue.vue';
import { set } from '@shell/utils/object';
import { NORMAN } from '@shell/config/types';
import { DESCRIPTION } from '@shell/config/labels-annotations';
import { clear } from '@shell/utils/array';
import { VuexStoreObject } from '@rancher/shell/core/types';
import { Translation } from '@rancher/shell/types/t';
import { VueRouter } from 'vue-router/types/router';
import {
  CREDENTIALS_UPDATE_REQUIRED, CREDENTIALS_NOT_REQUIRED, CAPIClusterTopology, CAPIClusterNetwork, CAPIClusterCPEndpoint, ClusterClass, CAPI, Worker
} from '../types/capi';
import ClusterClassVariables from '../components/CCVariables/index.vue';
import { versionTest, versionValidator } from '../util/validators';

import WorkerItem from './WorkerItem.vue';
import NetworkSection from './NetworkSection.vue';
import ControlPlaneEndpointSection from './ControlPlaneEndpointSection.vue';

const defaultTopologyConfig: CAPIClusterTopology = {
  version: '',
  class:   '',
  workers:           { machineDeployments: [], machinePools: [] }
};
const defaultClusterNetwork: CAPIClusterNetwork = {
  apiServerPort: 6443,
  pods:          { cidrBlocks: [] },
  serviceDomain: '',
  services:      { cidrBlocks: [] }
};

const defaultCPEndpointConfig: CAPIClusterCPEndpoint = {
  host: '',
  port: 49152
};

export default defineComponent({
  name: 'CreateCluster',

  components: {
    CruResource,
    Loading,
    NameNsDescription,
    RadioGroup,
    LabeledSelect,
    LabeledInput,
    WorkerItem,
    ClusterClassVariables,
    LabelValue,
    NetworkSection,
    ControlPlaneEndpointSection
  },

  mixins: [CreateEditView, FormValidation],

  props:      {
    mode: {
      type:     String,
      required: true,
    },
    value: {
      type:     Object,
      required: true,
    },
    provider: {
      type:     String,
      required: true,
    }
  },

  async fetch() {
    await this.getClusterClasses();
    this.initSpecs();
  },

  data() {
    const t = this.t as Translation;
    const stepBasics = {
      name:           'stepBasics',
      title:          t('capi.cluster.steps.basics.title'),
      label:          t('capi.cluster.steps.basics.label'),
      subtext:        '',
      descriptionKey: 'capi.cluster.steps.basics.description',
      ready:          false,
      weight:         30
    };

    const stepConfiguration = {
      name:           'stepConfiguration',
      title:          t('capi.cluster.steps.configuration.title'),
      label:          t('capi.cluster.steps.configuration.label'),
      subtext:        '',
      descriptionKey: 'capi.cluster.steps.configuration.description',
      ready:          false,
      weight:         30
    };

    const addSteps = [stepBasics, stepConfiguration].sort((a, b) => (b.weight || 0) - (a.weight || 0));

    return {
      fvFormRuleSets:          [{ path: 'spec.topology.version', rules: [versionValidator] }],
      addSteps,
      credentialId:            '',
      credential:              null,
      versionInfo:             {},
      allNamespaces:           [],
      shouldCreateCredential:  CREDENTIALS_UPDATE_REQUIRED.includes(this.provider),
      providers:               [],
      clusterClasses:          [] as ClusterClass[],
      defaultWorkerAddValue:   {
        name:  '',
        class: ''
      },
      variablesReady: false,
      clusterClass:   ''
    };
  },

  watch: {
    shouldCreateCredential(neu) {},
    credentialId(val) {
      const store = this.$store as VuexStoreObject;

      if ( val ) {
        this.credential = store.getters['rancher/byId'](NORMAN.CLOUD_CREDENTIAL, this.credentialId);
      } else {
        this.credential = null;
      }
    }
  },

  computed: {
    version() {
      return this.value.spec.topology.version;
    },

    canUpdateCredential() {
      return !CREDENTIALS_NOT_REQUIRED.includes(this.provider) && !CREDENTIALS_UPDATE_REQUIRED.includes(this.provider);
    },

    modeOptions() {
      const t = this.t as Translation;

      return [{
        label: t('capi.cluster.secret.reuse'),
        value: false,
      }, {
        label: t('capi.cluster.secret.create'),
        value: true,
      }];
    },

    stepOneRequires() {
      return !!this.value.metadata.name && !!this.clusterClass && !!this.variablesReady;
    },

    stepTwoRequires() {
      const store = this.$store as VuexStoreObject;
      const versionTestString = versionTest(store.getters['i18n/t'], this.controlPlane);
      const versionValid = this.version && !!(this.version.match(versionTestString));
      const controlPlaneEndpointValid = !!this.value.spec.controlPlaneEndpoint.host && !!this.value.spec.controlPlaneEndpoint.port;
      const machineDeploymentsValid = this.value.spec.topology.workers.machineDeployments.length > 0 && !!this.value.spec.topology.workers.machineDeployments[0]?.name && !!this.value.spec.topology.workers.machineDeployments[0]?.class;
      const machinePoolsValid = this.value.spec.topology.workers.machinePools.length > 0 && !!this.value.spec.topology.workers.machinePools[0]?.name && !!this.value.spec.topology.workers.machinePools[0]?.class;

      return versionValid && controlPlaneEndpointValid && (machineDeploymentsValid || machinePoolsValid);
    },
    clusterClassOptions(): string[] {
      const out: string[] = [];

      this.clusterClasses.forEach((obj: ClusterClass) => {
        if (obj?.metadata?.name) {
          out.push(obj.metadata.name);
        }
      });

      return out;
    },

    clusterNetwork() {
      return this.value.spec.clusterNetwork;
    },

    controlPlaneEndpoint() {
      return this.value.spec.controlPlaneEndpoint;
    },

    clusterClassObj(): ClusterClass | undefined {
      return this.clusterClasses.find(x => x.metadata.name === this.clusterClass);
    },

    clusterClassDescription() {
      return this.clusterClassObj?.metadata?.annotations?.[DESCRIPTION] || this.clusterClassObj?.metadata?.annotations?.description || '';
    },

    machineDeploymentOptions() {
      return this.clusterClassObj?.spec?.workers?.machineDeployments?.map( w => w.class);
    },

    machinePoolOptions() {
      return this.clusterClassObj?.spec?.workers?.machinePools?.map( w => w.class);
    },

    controlPlane() {
      return this.clusterClassObj?.spec?.controlPlane?.ref?.name;
    },

    versionRule() {
      const t = this.t as Translation;

      return versionValidator(t, this.controlPlane);
    }
  },
  methods: {
    set,
    generateYaml() {},
    async saveOverride() {
      if ( this.errors ) {
        clear(this.errors);
      }
      await this.value.save();

      return this.done();
    },

    initSpecs() {
      if ( !this.value.spec ) {
        set(this.value, 'spec', { });
      }
      if ( !this.value.spec.topology ) {
        set(this.value.spec, 'topology', defaultTopologyConfig);
      }

      if ( !this.value.spec.clusterNetwork ) {
        set(this.value.spec, 'clusterNetwork', defaultClusterNetwork);
      }

      if ( !this.value.spec.controlPlaneEndpoint ) {
        set(this.value.spec, 'controlPlaneEndpoint', defaultCPEndpointConfig);
      }
    },

    async getClusterClasses() {
      const store = this.$store as VuexStoreObject;
      const allClusterClasses: ClusterClass[] = await store.dispatch('management/findAll', { type: CAPI.CLUSTER_CLASS });

      this.clusterClasses = allClusterClasses.filter(cc => cc.spec.infrastructure.ref.name === this.provider);
    },

    stepOneReady() {
      this.$set(this.addSteps[0], 'ready', this.stepOneRequires);
    },

    stepTwoReady() {
      this.$set(this.addSteps[1], 'ready', this.stepTwoRequires);
    },

    // cancelCredential() {
    //   if ( this.$refs.cruresource ) {
    //     this.$refs.cruresource.emitOrRoute();
    //   }
    // },
    validateVariables(neu: boolean) {
      this.variablesReady = neu;
      this.stepOneReady();
    },
    cancel() {
      const router = this.$router as VueRouter;

      router.push({
        name:   'c-cluster-manager-capi',
        params: {},
      });
    },
    done() {
      const router = this.$router as VueRouter;

      router.push({
        name:   'c-cluster-manager-capi',
        params: {},
      });
    },
    clusterClassChanged(val: String) {
      this.set(this.value.spec.topology, 'class', val);
      this.stepOneReady();
    },
    machineDeploymentsChanged(val: Worker) {
      this.set(this.value.spec.topology.workers, 'machineDeployments', val);
      this.stepTwoReady();
    },
    machinePoolsChanged(val: Worker) {
      this.set(this.value.spec.topology.workers, 'machinePools', val);
      this.stepTwoReady();
    },
    cpEndpointHostChanged(val: String) {
      this.set(this.value.spec.controlPlaneEndpoint, 'host', val);
      this.stepTwoReady();
    },
    cpEndpointPortChanged(val: Number) {
      this.set(this.value.spec.controlPlaneEndpoint, 'port', val);
      this.stepTwoReady();
    },
  }
});
</script>
<template>
  <div>
    <Loading v-if="$fetchState.pending" />
    <CruResource
      v-else
      ref="cruresource"
      :mode="mode"
      :validation-passed="fvFormIsValid"
      :show-as-form="true"
      :resource="value"
      :errors="errors"
      :cancel-event="true"
      :done-route="doneRoute"
      :apply-hooks="applyHooks"
      :generate-yaml="generateYaml"
      :steps="addSteps"
      class="provider"
      component-testid="capi-provider-create"
      @done="done"
      @finish="saveOverride"
      @cancel="cancel"
      @error="fvUnreportedValidationErrors"
    >
      <template #stepBasics>
        <NameNsDescription
          v-if="!isView"
          v-model="value"
          :mode="mode"
          :namespaced="false"
          :namespace-options="allNamespaces"
          name-label="cluster.name.label"
          name-placeholder="cluster.name.placeholder"
          description-label="cluster.description.label"
          description-placeholder="cluster.description.placeholder"
          :rules="{name:fvGetAndReportPathRules('metadata.name')}"
          @change="stepOneReady"
        />
        <h2>
          <t k="capi.cluster.providerConfig.title" />
        </h2>

        <div v-if="canUpdateCredential">
          <RadioGroup
            v-model="shouldCreateCredential"
            name="shouldCreateCredential"
            :mode="mode"
            :options="modeOptions"
          />
        </div>
        <div v-if="shouldCreateCredential">
        </div>
        <div
          v-else
          class="mt-20"
        >
        </div>

        <div class="row mb-20">
          <div class="col span-3">
            <LabeledSelect
              v-model="clusterClass"
              :mode="mode"
              :options="clusterClassOptions"
              label-key="capi.cluster.clusterClass.label"
              required
              @input="clusterClassChanged"
            />
          </div>
          <div v-if="!!clusterClassDescription">
            <LabelValue
              :name="t('capi.cluster.clusterClass.description')"
              :value="clusterClassDescription"
            />
          </div>
        </div>
        <div class="spacer" />
        <div v-if="!!clusterClassObj">
          <h2>
            <t k="capi.cluster.variables.title" />
          </h2>
          <ClusterClassVariables
            v-model="value.spec.topology.variables"
            :cluster-class="clusterClassObj"
            @validation-passed="validateVariables"
          />
        </div>
      </template>
      <template #stepConfiguration>
        <div class="mt-20">
          <h2>
            <t k="capi.cluster.version.title" />
          </h2>
          <div class="row mb-20">
            <div class="col span-3">
              <LabeledInput
                v-model="value.spec.topology.version"
                :mode="mode"
                label-key="cluster.kubernetesVersion.label"
                required
                :rules="versionRule"
                @input="stepTwoReady"
              />
            </div>
          </div>
        </div>

        <div class="spacer" />
        <div class="mt-20">
          <h2>
            <t k="capi.cluster.networking.title" />
          </h2>
          <NetworkSection
            v-model="clusterNetwork"
            :mode="mode"
            @api-server-port-changed="(val) => $set(value.spec.clusterNetwork, 'apiServerPort', val)"
            @service-domain-changed="(val) => $set(value.spec.clusterNetwork, 'serviceDomain', val)"
            @pods-cidr-blocks-changed="(val) => $set(value.spec.clusterNetwork.pods, 'cidrBlocks', val)"
            @services-cidr-blocks-changed="(val) => $set(value.spec.clusterNetwork.services, 'cidrBlocks', val)"
          />
        </div>

        <div class="spacer" />
        <div class="mt-20">
          <h2>
            <t k="capi.cluster.controlPlaneEndpoint.title" />
          </h2>
          <ControlPlaneEndpointSection
            v-model="controlPlaneEndpoint"
            :mode="mode"
            @control-plane-endpoint-host-changed="cpEndpointHostChanged"
            @control-plane-endpoint-port-changed-changed="cpEndpointPortChanged"
          />
        </div>

        <div class="spacer" />
        <div class="mt-20">
          <h2>
            <t k="capi.cluster.workers.title" />
          </h2>
          <div class="row mb-20">
            <div
              v-if="!!machineDeploymentOptions"
              class="col span-3"
            >
              <WorkerItem
                v-model="value.spec.topology.workers.machineDeployments"
                :mode="mode"
                :title="t('capi.cluster.workers.machineDeployments.title')"
                :default-add-value="defaultWorkerAddValue"
                :class-options="machineDeploymentOptions"
                :initial-empty-row="true"
                @input="machineDeploymentsChanged"
              />
            </div>
            <div
              v-if="!!machinePoolOptions"
              class="col span-3"
            >
              <WorkerItem
                v-model="value.spec.topology.workers.machinePools"
                :mode="mode"
                :title="t('capi.cluster.workers.machinePools.title')"
                :default-add-value="defaultWorkerAddValue"
                :class-options="machinePoolOptions"
                :initial-empty-row="true"
                @input="machinePoolsChanged"
              />
            </div>
          </div>
        </div>
      </template>
    </CruResource>
  </div>
</template>
