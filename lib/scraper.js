/*
* copyright 2010 Ryan Day
* http://github.com/soldair/node-qrcode
*
* Licensed under the MIT license:
* http://www.opensource.org/licenses/mit-license.php
*
*/
var jsdom = require('jsdom')
	, dom = jsdom.jsdom
	, url = require('url')
	, http = require('http')
	, fs = require('fs');

module.exports = exports = {
	get:function(target_url,complete,headers){
		this.doRequest('GET',target_url,'',complete,headers);
	},
	post:function(target_url,data,complete,headers){
		this.doRequest('POST',target_url,data,complete,headers);
	},
	//TODO scraper will not properly follow Location redirects
	//TODO scraper could offer cookie jar
	doRequest:function(method,target_url,data,complete,headers){

		var parsed = url.parse(target_url),
			secure = parsed.protocol == 'https:';

		//console.log('httpClient.request: '+parsed.href);
		
		var client = http.createClient(secure?443:80, parsed.host,secure),
			headers = extend({'host': parsed.host},headers||{});
			
		if(data && data.length){
			headers['Content-Length'] = data.length;
		}

		var request = client.request(method, parsed.href,headers);

		if(data && data.length){
			request.write(data);
		}
			
		request.end();
		request.on('response', function (response) {
			response.setEncoding('utf8');
			
			var body = '';

			//console.log("status code "+response.statusCode);
			//console.log(response.headers);
			
			response.on('data', function (chunk) {
				body += chunk;
			});
			
			response.on('end',function(){
				complete(body,response);
			});
		});
	},
	loadDom:function(xml_html,config){
		try{
			return jsdom.jsdom(xml_html,null,config||{
					features:{
						ProcessExternalResources: false
						,FetchExternalResources: false
					}
			});
			
		}catch (e) {
			console.log("get_dom exception: "+e);
		}
		return false;
	},
	injectScript:function(document,path,cb){
		var window = document.parentWindow;
		fs.readFile(path,function(err,code){
			if(!err){
				var err = false;
				try{
					var Script = process.binding('evals').Script;
					Script.runInNewContext(code.toString(), window,path);
				} catch(err) {}
			}
			cb(err,document.parentWindow);
		});
	},
	injectSizzle:function(document,cb){
		if(document.parentWindow.Sizzle) {
			cb(false,document.parentWindow);
			return;
		}
		this.injectScript(document,__dirname+'/../include/sizzle.js',cb);
	},
	injectJquery:function(document,cb){
		if(document.parentWindow.jQuery) {
			cb(false,document.parentWindow);
			return;
		}
		this.injectScript(document,__dirname+'/../include/jquery.js',cb);
	}
};


function CookieJar(){}

CookieJar.prototype = {
	jar:{},
	set:function(cookieData){
		var z = this;
		cookieData.forEach(function(cookie){
			var parts = cookie.split(';')
				, kv = parts.shift();
			if(kv.length){
				kv = kv.split('=');
				z.jar[kv.shift()] = kv.shift();
			}
		})
	},
	get:function(){
		var cookies = '';
		for(var i in this.jar) {
			cookies += i+'='+this.jar[i]+'; ';
		}
		return cookies;
	},
	clear:function(){
		this.jar = {};
	}
}

function extend(extends,object){
	var out = {};
	for(var i in object){
		out[i] = object[i];
	}
	
	for( var k in extends){
		out[k] = extends[k];
	}
	
	return out;
}