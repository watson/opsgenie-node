# opsgenie-node

A Node.js module for sending heartbeats to [OpsGenie](https://www.opsgenie.com/).

## Why?

When operating a Node.js app, you need to be notified of downtime. Services like [Pingdom](http://pingdom.com) allow you to monitor the availability of your app by pinging it periodically and alerting you if it cannot be reached. But this requires your app to be available online.

If your app is running behind a firewall (intranet) or it's a background job not inteded to be publically available, Pingdom and similar services have no way of pinging it. The solution of cause is to reverse the roles and let your app ping the monitoring service. [OpsGenie provide such an API](http://support.opsgenie.com/customer/portal/articles/759603-heartbeat-monitoring).

## Usage

You can either configure OpsGenie using environment variables, or configure it using the `.heartbeat()` function.

OpsGenie environment variables:

* `OPSGENIE_API_KEY` - Your personal OpsGenie API key
* `OPSGENIE_SOURCE` - The hostname that the OpsGenie heartbeat agent should register as (optional)

If no source is provided, either by `OPSGENIE_SOURCE` or by setting it via the `.heartbeat()` function, the hostname of the server will be used.

**Example 1** - Using OpsGenie with environment variables:

```javascript
require('opsgenie');
```

**Example 2*** - Configure OpsGenie using the `.heartbeat()` function:

```javascript
require('opsgenie').heartbeat({
  apiKey: 'eb243592-faa2-4ba2-a551q-1afdf565c889',
  source: 'host-name'
});
```

## License

MIT
