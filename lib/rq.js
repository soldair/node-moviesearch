/*
simplified httpClient wrapper with the intention that it be extendable and listenable
like real prototype extendable

event though http client is great at sending requests i need redirect following and COOKIES!

node-utils request by mikael does not have a cookie jar feature nore is extendable
https://github.com/mikeal/node-utils/blob/master/request/main.js

you can't scrape some sites if you dont have cookie support =(

*/
var http = require('http'), url = require('url'), EventEmitter = require('events').EventEmitter;


function rq(options,cb){
	if(!this.request) {
		//static style call
		return new rq(options,cb);
	}
	if(options) this.request(options,cb);
};

rq.prototype =  new EventEmitter();
extend(rq.prototype,{
	//PROPERTIES
	defaultOptions:{cookieJar:true,followRedirects:true,maxRedirects:10},
	currentOptions:{},
	currentCookieJar:false,
        currentCallback:false,
	responseHandlers:[],
	responseBodyHandlers:[],
	clients:{},
	//METHODS
	request:function(options,cb) {
		var z = this;
		this.responseHandlers = [];

		//headers required
		options.headers = options.headers||{};
		options.uri = options.uri||false;
		
		//include all default options
		this.currentOptions = options = this.mergeOptions(options);
		
		//set callback to object just in case recursion is required to satisfy request processing
		this.currentCallback = cb;
		//support async compat hooks for processing individual options
		this.callbackOptions(options,function(err,options){
			//console.log(options);
			if(err) {
				//if there was an error processing options lets bailout
				z.emit('error',err);
				cb(err,false);
			}

			var port = z.deducePort(options);

			var client = http.createClient(port, options.uri.host,options.uri.protocol == 'https:'?true:false);

			//notify on client created
			z.emit('client',client);
			
			var headers = extend({'host': options.uri.host},options.headers);
			
			var fullpath = options.uri.href.replace(options.uri.protocol + '//' + options.uri.host, '');
			if (fullpath.length === 0) options.fullpath = '/' 
			
			//TODO ADD POST/METHOD SUPPORT
			var request = client.request('GET', fullpath,headers);
			//notify on request created
			z.emit('request',request);

			//prepare for failure
			request.on('error',function(err){
				cb(err,false);
			});
			
			//send the request
			request.end();
			
			//party on
			request.on('response', function (response) {
				//it may take a while async style to setup and run responseHandlers. dont lose anything
				response.pause();
				
				//these functions manage the calling of responseHandlers in order defined
				//this allows next and done express like interface to handling responses
				var done = function(err,shouldContinue){
					
					if(!shouldContinue) {
						response.destroy();
						return;
					}

					var done = function(err,body){
						cb(err,body);
					}

					//all response
					if(z.responseBodyHandlers.length){
						while(z.responseBodyHandlers.length) {
							z.responseBodyHandlers.shift().call(z,response,done);
						}
					} else {
						z.defaultResponseBodyHandler(response,done);
					}

					//TODO dont set this bindly to the wrong encoding. this is not example world
					response.setEncoding('utf8');
					response.resume();
				}
				, next = function next(){
					var handler = z.responseHandlers.pop();
					if(handler) {
						handler.call(z,response,done,next);
					} else {
						z.defaultResponseHandler(response,done,function(){
							z.emit('error','default response handler should not call next');
						});
					}
				};
				
				next();
			});
		});
	},
	cookieJar:function() {
		return CookieJar;
	},
	deducePort:function(options){
		if(options.uri.port) {
			return options.uri.port;
		}
		return options.uri.protocol == 'https:'?443:80;
	},
	mergeOptions:function(options) {
		//if no options hope that everything we need is set to default
		if(!options) options = {};
		//support string uri
		if(options.substr) options = {uri:options};
		
		options = extend({},this.defaultOptions,options);
		return options;
	},
	defaultResponseHandler:function(response,done,next){
		//console.log('STATUS: ' + response.statusCode);
		//console.log('HEADERS: ' + JSON.stringify(response.headers));
		done(false,true);
	},
	defaultResponseBodyHandler:function(response,cb){
		var body = '';
		response.on('data', function (chunk) {
			body += chunk;
		});

		response.on('end',function(){
			cb(false,body);
		});
	},
	callbackOptions:function(options,cb){
		var len = countProperties(options), optionCallback, errors = [];
		
		for(var i in options) {

			optionCallback = 'option'+i.split('')[0].toUpperCase()+i.substr(1);

			len--;
			if(typeof this[optionCallback] == "function"){
				
				try{
					this[optionCallback].call(this,options[i],function(err,value){
						if(err) errors.push(err);
						options[i] = value;
						
						if(!len) {
							cb(errors.length?errors:false,options);
							len--;
						}
					});
				} catch(e){
					console.log(e.toString+"\n"+e.stack);
					console.log('Error processing custom callback for option '+optionCallback);
				}
			}
		}
		
		if(len == 0) {
			cb(false,options);
		}
	},
	//OPTIONS CALLBACKS
	optionUri:function(value,cb){
		if(value) {
			if(value.substr){
				value = url.parse(value)
			}
			
			if(value.host && value.href) {
				cb(false,value);
				return;
			}
		}
		cb('uri required',false);
	},
	optionCookieJar:function(value,cb){
		if(value){
			//prepare cookieJar if its not already
			if(!this.currentCookieJar) {
				var cj = this.cookieJar();
				this.currentCookieJar = new cj();
			}
		} else {
			//destroy existing cookieJar
			this.currentCookieJar = false;
		}
		cb(false,value);
		return;
	},
	optionFollowRedirects:function(value,cb){
		//executed in this context ... fyi
		
		if(!value) {
			cb(false,value);
			return;
		}
		
		var max = this.currentOptions.maxRedirects||10;
		if(!this.currentOptions.usedRedirects) this.currentOptions.usedRedirects = 0;

		
		this.responseHandlers.push(function(response,done,next){
			//if i see a location redirect no matter the status code
			if(this.currentCookieJar) {
				this.currentCookieJar.set(response.headers['set-cookie']||[]);
				if(!this.currentOptions.headers) this.currentOptions.headers = {};
			}
			
			if(response.headers.location){
				
				var parsed = url.parse(response.headers.location);
				if(!parsed.host) {
					response.headers.location = this.currentOptions.uri.protocol+'//'+this.currentOptions.uri.host+response.headers.location;
				}
				
				if(this.currentCookieJar){
					this.currentOptions.headers['Cookie'] = this.currentCookieJar.get(response.headers.location);
				}
				
				this.currentOptions.usedRedirects++;
				if(this.currentOptions.usedRedirects == max) {
					var error = 'max redirects '+max+' exceded attempting to download '+this.currentOptions.uri.href;
					done(error,false);
				} else {
					this.currentOptions.uri = response.headers.location;
					this.request(this.currentOptions,this.currentCallback);
				}
				return;
			}
			next();
		});
		cb(false,value);
	},
	optionResponseBodyStream:function(value,cb){
		if(value){
			this.responseBodyHandlers.push(function(response){
				sys.pump(response, value);
				return false;
			});
		}
		cb(false,value);
	}
	
});

//EXPORTS
module.exports = exports = rq;


function CookieJar(){}
CookieJar.prototype = {
	jar:[],
	set:function(cookieData){
		var z = this;
		cookieData.forEach(function(cookie){
			var parts = cookie.split(';');
			var cookie = {};
			for(var i = 0,j=parts.length;i<j;i++){
				var kv = parts[i].split('='),
				   key = kv[0].trim().toLowerCase();
				
				if(i==0){
					cookie.value = parts[i];
					cookie.key = key;
				} else {
					if(kv[1]){
						cookie[key] = (kv[1]||'').trim();
						if(key == 'expires') {
							cookie[key] = new Date(cookie[key]);
						}
					} else {
						//http only and such
					}
				}
			}

			z.jar.push(cookie);

		});
	},
	get:function(href){
		var uri = url.parse(href)
			, domain = uri.host
			, hasExpired = 0
			, cookies = '';

		for(var i=0;i<this.jar.length;i++) {
			var cookie = this.jar[i];
			//enforce expires
			if(cookie.expires && cookie.expires <= new Date()){
				//console.log('expired cookie');
				this.jar.splice(i,1);
				i--;
				continue;
			}
			//enforce domain
			if(cookie.domain && domain.indexOf(cookie.domain) == -1){
				//console.log('bad cookie domain '+cookie.domain+' for '+domain);
				continue;
			}
			//enforce path
			if(cookie.path && (uri.pathname||'/').indexOf(cookie.path) == -1) {
				//console.log('bad cookie path '+cookie.path+' for '+(uri.pathname||'/'));
				continue;
			}
			cookies += cookie.value+'; ';
		}

		return cookies;
	},
	clear:function(){
		this.jar = {};
	}
}

function extend(){
	var o = arguments[0];
	for(var i = 1,j=arguments.length;i<j;i++){
		for(var property in arguments[i]){
			o[property] = arguments[i][property];
		}
	}
	return o;
}

function countProperties(o){
	var i=0;
	for(var p in o) i++;
	return i;
}